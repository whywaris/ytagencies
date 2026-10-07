// Database access tests: the real schema + seed in PGlite (in-process Postgres) with Supabase-like
// roles, grants and auth.uid(). Run with `pnpm test`.
//   node supabase/tests/access.mjs               fresh project: supabase/schema.sql
//   node supabase/tests/access.mjs --migrations  existing project: initial schema + migrations/
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const MIGRATIONS = process.argv.includes("--migrations");
// The schema as first committed, before any migration (scaffold commit).
const INITIAL_SCHEMA_COMMIT = "9b2e225";
const db = new PGlite({ extensions: { btree_gist } });
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  create schema storage; grant usage on schema storage to anon, authenticated;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id bigserial primary key, bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant all on storage.objects to anon, authenticated; grant all on sequence storage.objects_id_seq to anon, authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant execute on function storage.foldername(text) to anon, authenticated;
`);
const noExt = (sql) => sql.replace('create extension if not exists "pgcrypto";', "");
if (MIGRATIONS) {
  // Existing-project path: the initial schema, then every migration in order.
  const initial = execFileSync("git", ["show", `${INITIAL_SCHEMA_COMMIT}:supabase/schema.sql`], {
    cwd: root,
    encoding: "utf8",
  });
  await db.exec(noExt(initial));
  for (const f of readdirSync(root + "supabase/migrations").sort()) {
    await db.exec(readFileSync(root + "supabase/migrations/" + f, "utf8"));
    console.log("applied migration", f);
  }
} else {
  await db.exec(noExt(readFileSync(root + "supabase/schema.sql", "utf8")));
}
console.log("mode:", MIGRATIONS ? "initial schema + migrations" : "fresh schema.sql");
await db.exec(readFileSync(root + "supabase/seed.sql", "utf8"));

const OWNER = "11111111-1111-4111-8111-111111111111",
  OTHER = "22222222-2222-4222-8222-222222222222";
const SUBMITTER = "33333333-3333-4333-8333-333333333333";
await db.exec(`
  insert into auth.users (id, email) values ('${OWNER}', 'o@quillfern.example'), ('${OTHER}', 'x@y.example'), ('${SUBMITTER}', 's@newco.example');
  update agencies set owner_id = '${OWNER}' where slug = 'quillfern-media';
  insert into agencies (id, slug, name, status) values ('00000000-0000-4000-8000-000000000099', 'draft-x', 'Draft X', 'draft'),
    ('00000000-0000-4000-8000-000000000098', 'archived-x', 'Archived X', 'archived');
  insert into agency_services (agency_id, service_id) select '00000000-0000-4000-8000-000000000099', id from services limit 1;
  insert into case_studies (agency_id, title) values ('00000000-0000-4000-8000-000000000099', 'Draft case study');
  insert into leads (id, name, email) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Lead for Quillfern', 'a@x.example'),
    ('aaaaaaaa-0000-4000-8000-000000000002', 'Lead for Pinecask', 'b@x.example');
  insert into lead_routes (lead_id, agency_id) select 'aaaaaaaa-0000-4000-8000-000000000001', id from agencies where slug = 'quillfern-media';
  insert into lead_routes (lead_id, agency_id) select 'aaaaaaaa-0000-4000-8000-000000000002', id from agencies where slug = 'pinecask-creative';
  insert into claims (agency_id, user_id, work_email) select id, '${OTHER}', 'x@pinecask.example' from agencies where slug = 'pinecask-creative';
  select hit_rate_limit('ip:test', 5, '1 hour');
  insert into storage.objects (bucket_id, name) values ('agency-media', 'agencies/00000000-0000-4000-8000-000000000001/logo.png');
`);

let failures = 0;
const ok = (c, m) => {
  console.log(c ? "ok  " : "FAIL", m);
  if (!c) failures++;
};
async function as(role, uid, fn) {
  await db.exec(
    `reset role; select set_config('request.jwt.sub', '${uid ?? ""}', false); set role ${role};`,
  );
  try {
    await fn();
  } finally {
    await db.exec("reset role; select set_config('request.jwt.sub', '', false);");
  }
}
const rows = async (sql) => (await db.query(sql)).rows;
// Refused (an error) or had no effect: no rows returned and none changed. A SELECT reports
// 0 affected rows even when it returns data, so rows are checked too.
const denied = async (sql) => {
  try {
    const r = await db.query(sql);
    return r.rows.length === 0 && (r.affectedRows ?? 0) === 0;
  } catch {
    return true;
  }
};

console.log("— anon (signed-out visitor, the public anon key) —");
await as("anon", null, async () => {
  ok((await rows("select * from leads")).length === 0, "leads: none readable");
  ok(
    await denied("insert into leads (name, email) values ('x', 'x@x.example')"),
    "leads: can't insert",
  );
  ok((await rows("select * from lead_routes")).length === 0, "lead_routes: none readable");
  ok((await rows("select * from claims")).length === 0, "claims: none readable");
  ok(
    await denied(
      `insert into claims (agency_id, user_id, work_email) select id, '${OTHER}', 'x@x.example' from agencies limit 1`,
    ),
    "claims: can't insert",
  );
  ok(
    (await rows("select id from agencies where status <> 'published'")).length === 0,
    "agencies: drafts and archived invisible",
  );
  ok(
    (await rows("select id from agencies where slug = 'draft-x'")).length === 0,
    "agencies: draft not fetchable by slug",
  );
  ok(
    (
      await rows(
        "select * from agency_services where agency_id = '00000000-0000-4000-8000-000000000099'",
      )
    ).length === 0,
    "agency_services of a draft: invisible",
  );
  ok(
    (
      await rows(
        "select * from case_studies where agency_id = '00000000-0000-4000-8000-000000000099'",
      )
    ).length === 0,
    "case_studies of a draft: invisible",
  );
  ok(
    (await rows("select * from reviews where status <> 'published'")).length === 0,
    "reviews: pending/rejected invisible",
  );
  ok(
    await denied(
      "insert into reviews (agency_id, author_name, rating, body, status) select id, 'x', 5, 'thirty characters of a fake review text', 'published' from agencies limit 1",
    ),
    "reviews: can't insert (not even as published)",
  );
  ok((await rows("select * from profiles")).length === 0, "profiles: none readable");
  ok((await rows("select * from rate_limits")).length === 0, "rate_limits: none readable");
  ok(await denied("select hit_rate_limit('ip:x', 5, '1 hour')"), "hit_rate_limit(): can't execute");
  ok(await denied("update agencies set description = 'x'"), "agencies: can't update");
  ok(await denied("delete from agencies"), "agencies: can't delete");
  ok(
    await denied("insert into services (slug, name) values ('x-agencies', 'X')"),
    "services: can't insert",
  );
  ok(
    (await rows("select * from storage.objects")).length === 0,
    "storage.objects: not listable (public files served by URL only)",
  );
  ok(
    await denied(
      "insert into storage.objects (bucket_id, name) values ('agency-media', 'agencies/00000000-0000-4000-8000-000000000001/x.png')",
    ),
    "storage: can't upload",
  );
  ok(
    (await rows("select id, slug, name, status from agencies where status = 'published'"))
      .length === 15,
    "agencies: published ones readable (expected)",
  );
  ok(await denied("select owner_id from agencies"), "agencies: owner_id not readable");
  ok(await denied("select * from agencies"), "agencies: select * refused (would include owner_id)");
  ok(
    await denied("select id from agencies where owner_id is not null"),
    "agencies: can't filter on owner_id either",
  );
  ok(
    (
      await rows(
        "select a.slug from agencies a join agency_services s on s.agency_id = a.id limit 1",
      )
    ).length === 1,
    "agencies + join tables still work for anon",
  );
  ok(
    (await rows("select * from case_studies")).length > 0 &&
      (await rows("select * from agency_locations")).length > 0,
    "case_studies / agency_locations of published agencies readable",
  );
  ok(
    (await rows("select * from combo_counts")).length > 0,
    "combo_counts view still works for anon",
  );
});

console.log("— signed-in user who owns nothing —");
await as("authenticated", OTHER, async () => {
  ok((await rows("select * from leads")).length === 0, "leads: none readable");
  ok((await rows("select * from claims")).length === 1, "claims: only their own (1)");
  ok(
    (await rows("select id from agencies where status <> 'published'")).length === 0,
    "agencies: other people's drafts invisible",
  );
  ok((await rows("select * from profiles")).length === 1, "profiles: only their own");
  ok(
    await denied("update agencies set owner_id = auth.uid() where slug = 'pinecask-creative'"),
    "can't take ownership of an agency",
  );
  ok(await denied("update claims set status = 'approved'"), "can't approve their own claim");
  ok(
    (await denied(`update profiles set role = 'admin' where id = '${OTHER}'`)) ||
      (await rows(`select role from profiles where id = '${OTHER}'`))[0].role === "user",
    "can't make themselves admin",
  );
});

console.log("— agency owner (Quillfern) —");
await as("authenticated", OWNER, async () => {
  const leads = await rows("select name from leads");
  ok(
    leads.length === 1 && leads[0].name === "Lead for Quillfern",
    "leads: only the one routed to them",
  );
  ok((await rows("select * from lead_routes")).length === 1, "lead_routes: only their own");
  ok((await rows("select * from claims")).length === 0, "claims: can't see others' claims");
  ok(
    await denied("update agencies set description = 'x' where slug = 'pinecask-creative'"),
    "can't edit another agency",
  );
  ok(
    await denied("update agencies set is_verified = true where slug = 'quillfern-media'"),
    "can't set verified on own agency",
  );
  ok(
    await denied("update agencies set status = 'published' where slug = 'quillfern-media'"),
    "can't change own status",
  );
  ok(
    (await rows("select owner_id from agencies where owner_id = auth.uid()")).length === 1,
    "owner can still read and filter by their own owner_id",
  );
  ok(
    !(await denied(
      "update agencies set description = 'owner edit' where slug = 'quillfern-media'",
    )),
    "owner can still edit their own agency",
  );
  ok(
    !(await denied(
      "insert into case_studies (agency_id, title) select id, 'Owner case study' from agencies where slug = 'quillfern-media'",
    )),
    "owner can still add case studies",
  );
});

console.log("— agency submissions (/list-your-agency) —");
const SUB = (n) => `00000000-0000-4000-9000-00000000000${n}`;
const submit = (id, extraCols = "", extraVals = "") =>
  `insert into agencies (id, slug, name, website, submitted_by${extraCols}) values ('${id}', 'sub-${id.slice(-1)}', 'Sub', 'https://newco.example', auth.uid()${extraVals})`;
await as("anon", null, async () => {
  ok(
    await denied(`insert into agencies (id, slug, name) values ('${SUB(9)}', 'anon-x', 'Anon')`),
    "anon: can't insert an agency",
  );
});
await as("authenticated", SUBMITTER, async () => {
  ok(await denied(submit(SUB(1), ", status", ", 'published'")), "can't insert a published agency");
  ok(await denied(submit(SUB(1), ", is_verified", ", true")), "can't insert is_verified");
  ok(await denied(submit(SUB(1), ", is_claimed", ", true")), "can't insert is_claimed");
  ok(
    await denied(submit(SUB(1), ", owner_id", ", auth.uid()")),
    "can't make themselves owner on insert",
  );
  ok(
    await denied(
      `insert into agencies (id, slug, name, submitted_by) values ('${SUB(1)}', 'sub-x', 'Sub', '${OTHER}')`,
    ),
    "can't submit in someone else's name",
  );
  ok(
    await denied(`insert into agencies (id, slug, name) values ('${SUB(1)}', 'sub-x', 'Sub')`),
    "can't insert without submitted_by",
  );
  ok(!(await denied(submit(SUB(1)))), "can insert a draft they submitted");
  const [mine] = await rows(
    `select status, owner_id, is_verified, is_claimed from agencies where id = '${SUB(1)}'`,
  );
  ok(
    mine?.status === "draft" && mine.owner_id === null && !mine.is_verified && !mine.is_claimed,
    "submission is a draft with no owner or flags, and visible to its submitter",
  );
  ok(
    !(await denied(`insert into agency_services (agency_id, service_id) values ('${SUB(1)}', 1)`)),
    "can add services to their own draft",
  );
  ok(
    !(await denied(
      `insert into agency_industries (agency_id, industry_id) values ('${SUB(1)}', 1)`,
    )),
    "can add industries to their own draft",
  );
  ok(
    !(await denied(
      `insert into agency_locations (agency_id, location_id) values ('${SUB(1)}', 1)`,
    )),
    "can add locations to their own draft",
  );
  ok(
    await denied(
      "insert into agency_services (agency_id, service_id) values ('00000000-0000-4000-8000-000000000099', 2)",
    ),
    "can't add services to someone else's draft",
  );
  ok(
    await denied(
      "insert into agency_services (agency_id, service_id) select id, 6 from agencies where slug = 'pinecask-creative'",
    ),
    "can't add services to a published agency they don't own",
  );
  ok(
    await denied(`update agencies set status = 'published' where id = '${SUB(1)}'`),
    "can't publish their submission",
  );
  ok(
    await denied(`update agencies set description = 'x' where id = '${SUB(1)}'`),
    "can't edit it before owning it",
  );
  ok(await denied(`delete from agencies where id = '${SUB(1)}'`), "can't delete it");
  ok(
    !(await denied(
      `insert into claims (agency_id, user_id, work_email) values ('${SUB(1)}', auth.uid(), 's@newco.example')`,
    )),
    "can open a pending claim on their submission",
  );
  ok(
    !(await denied(submit(SUB(2)))) && !(await denied(submit(SUB(3)))),
    "can have up to 3 open submissions",
  );
  ok(await denied(submit(SUB(4))), "4th open submission refused");
});
await as("authenticated", OTHER, async () => {
  ok(
    (await rows(`select id from agencies where submitted_by is not null`)).length === 0,
    "other users can't see someone's submission",
  );
  ok(
    await denied(`insert into agency_services (agency_id, service_id) values ('${SUB(1)}', 2)`),
    "other users can't attach to someone's submission",
  );
});
await as("anon", null, async () => {
  ok(await denied("select submitted_by from agencies"), "anon: submitted_by not readable");
  ok(
    (await rows(`select id from agencies where id = '${SUB(1)}'`)).length === 0,
    "anon: submission invisible",
  );
});

console.log("— plans, subscriptions, sponsored slots, verifications, events, audit (§7) —");
const ADMIN = "44444444-4444-4444-8444-444444444444";
const idOf = async (slug) => (await rows(`select id from agencies where slug = '${slug}'`))[0].id;
const QUILL = await idOf("quillfern-media"); // owned by OWNER
const PINE = await idOf("pinecask-creative");
const SALT = await idOf("saltmere-studios");
await db.exec(`
  delete from agency_subscriptions; -- the seed's sample Founding agencies; these tests set their own
  insert into auth.users (id, email) values ('${ADMIN}', 'admin@x.example');
  update profiles set role = 'admin' where id = '${ADMIN}';
  insert into agency_subscriptions (agency_id, plan_id, source, ends_at)
    values ('${QUILL}', 'founding', 'founding', now() + interval '6 months'),
           ('${PINE}', 'verified', 'manual', null);
  insert into verifications (agency_id, status) values ('${PINE}', 'requested');
  insert into admin_actions (admin_id, action, entity_type, entity_id) values ('${ADMIN}', 'agency.publish', 'agency', '${QUILL}');
  insert into sponsored_slots (service_id, industry_id, agency_id, position, starts_at, ends_at)
    values (1, 1, '${QUILL}', 1, now(), now() + interval '30 days');
`);
const rec = async (agency, type, visitor) =>
  (
    await db.query(`select record_agency_event($1, $2, '/agency/x', $3) ok`, [
      agency,
      type,
      visitor,
    ])
  ).rows[0].ok;
ok((await rec(QUILL, "profile_view", "v1")) === true, "events: first view recorded");
ok(
  (await rec(QUILL, "profile_view", "v1")) === false,
  "events: same visitor, same day, not counted twice",
);
ok((await rec(QUILL, "profile_view", "v2")) === true, "events: another visitor counted");
await rec(PINE, "website_click", "v1");
const [daily] = await rows(
  `select count from agency_event_daily where agency_id = '${QUILL}' and type = 'profile_view'`,
);
ok(daily?.count === 2, "events: daily rollup counts unique visitors (2)");
await db.exec(
  `insert into agency_events (agency_id, type, visitor_hash, created_at) values ('${QUILL}', 'contact_open', 'old', now() - interval '91 days')`,
);
await rec(QUILL, "contact_open", "v1");
ok(
  (await rows("select 1 from agency_events where visitor_hash = 'old'")).length === 0,
  "events: raw events older than 90 days pruned",
);
const inquiries = async () =>
  (
    await rows(
      `select coalesce(sum(count), 0)::int n from agency_event_daily where agency_id = '${QUILL}' and type = 'inquiry'`,
    )
  )[0].n;
const before = await inquiries();
await db.exec(`insert into leads (id, name, email) values ('aaaaaaaa-0000-4000-8000-000000000003', 'Inquiry', 'i@x.example');
  insert into lead_routes (lead_id, agency_id) values ('aaaaaaaa-0000-4000-8000-000000000003', '${QUILL}')`);
ok((await inquiries()) === before + 1, "events: a routed lead counts as one inquiry");

await as("anon", null, async () => {
  for (const t of [
    "plans",
    "agency_subscriptions",
    "sponsored_slots",
    "verifications",
    "agency_events",
    "agency_event_daily",
    "admin_actions",
  ]) {
    ok(await denied(`select * from ${t}`), `anon: ${t} not readable`);
  }
  ok(
    await denied(`select record_agency_event('${QUILL}', 'profile_view', '/x', 'anon')`),
    "anon: can't call record_agency_event",
  );
  ok(
    await denied(
      `insert into agency_events (agency_id, type, visitor_hash) values ('${QUILL}', 'profile_view', 'x')`,
    ),
    "anon: can't insert events directly",
  );
});
await as("authenticated", OWNER, async () => {
  ok((await rows("select * from plans")).length === 3, "owner: plans readable (3)");
  const subs = await rows("select agency_id from agency_subscriptions");
  ok(subs.length === 1 && subs[0].agency_id === QUILL, "owner: only their own subscription");
  ok(
    (await rows("select * from verifications")).every((v) => v.agency_id === QUILL),
    "owner: only their own verifications",
  );
  const roll = await rows("select distinct agency_id from agency_event_daily");
  ok(roll.length === 1 && roll[0].agency_id === QUILL, "owner: only their own event rollups");
  ok((await rows("select * from agency_events")).length === 0, "owner: raw events hidden");
  ok((await rows("select * from admin_actions")).length === 0, "owner: audit log hidden");
  ok((await rows("select * from sponsored_slots")).length === 0, "owner: sponsored slots hidden");
  ok(
    await denied(
      `insert into agency_subscriptions (agency_id, plan_id, source) values ('${QUILL}', 'verified', 'manual')`,
    ),
    "owner: can't give themselves a plan",
  );
  ok(
    await denied(`update agency_subscriptions set ends_at = null where agency_id = '${QUILL}'`),
    "owner: can't extend their plan",
  );
  ok(
    await denied(`insert into verifications (agency_id, status) values ('${QUILL}', 'approved')`),
    "owner: can't approve their own verification",
  );
  ok(
    await denied(`update agencies set is_verified = true where id = '${QUILL}'`),
    "owner: can't set is_verified",
  );
  ok(
    await denied(
      `insert into sponsored_slots (service_id, agency_id, position, starts_at, ends_at) values (2, '${QUILL}', 1, now(), now() + interval '1 day')`,
    ),
    "owner: can't buy a slot directly",
  );
  ok(
    await denied(
      `insert into agency_event_daily (agency_id, day, type, count) values ('${QUILL}', current_date, 'profile_view', 999)`,
    ),
    "owner: can't inflate their stats",
  );
  ok(
    await denied(`select record_agency_event('${QUILL}', 'profile_view', '/x', 'self')`),
    "owner: can't call record_agency_event",
  );
  ok(await denied(`delete from admin_actions`), "owner: can't touch the audit log");
});
await as("authenticated", OTHER, async () => {
  ok(
    (await rows("select * from agency_subscriptions")).length === 0,
    "other user: no subscriptions visible",
  );
  ok(
    (await rows("select * from agency_event_daily")).length === 0,
    "other user: no rollups visible",
  );
  ok(
    (await rows("select * from verifications")).length === 0,
    "other user: no verifications visible",
  );
});
await as("authenticated", ADMIN, async () => {
  ok(
    (await rows("select * from agency_subscriptions")).length === 2,
    "admin: reads all subscriptions",
  );
  ok((await rows("select * from admin_actions")).length === 1, "admin: reads the audit log");
  ok((await rows("select * from agency_events")).length > 0, "admin: reads raw events");
  ok(
    !(await denied(
      `update agency_subscriptions set status = 'cancelled' where agency_id = '${PINE}'`,
    )),
    "admin: can change a plan",
  );
  ok(await denied(`delete from admin_actions`), "admin: audit log is append-only, even for admins");
  ok(await denied(`update admin_actions set action = 'x'`), "admin: can't rewrite the audit log");
});

// Constraints (as the service role would hit them).
const fails = async (sql) => {
  try {
    await db.exec(sql);
    return false;
  } catch {
    return true;
  }
};
ok(
  await fails(
    `insert into agency_subscriptions (agency_id, plan_id, source) values ('${QUILL}', 'verified', 'manual')`,
  ),
  "subscriptions: one active row per agency",
);
ok(
  !(await fails(
    `insert into agency_subscriptions (agency_id, plan_id, status, source) values ('${QUILL}', 'free', 'expired', 'manual')`,
  )),
  "subscriptions: past rows can sit alongside the active one",
);
ok(
  await fails(
    `insert into agency_subscriptions (agency_id, plan_id, source) values ('${SALT}', 'gold', 'manual')`,
  ),
  "subscriptions: unknown plan refused",
);
const slot = (agency, pos, from, to, industry = "1", location = "null") =>
  `insert into sponsored_slots (service_id, industry_id, location_id, agency_id, position, starts_at, ends_at)
   values (1, ${industry}, ${location}, '${agency}', ${pos}, now() + interval '${from} days', now() + interval '${to} days')`;
ok(await fails(slot(PINE, 1, 10, 40)), "slots: same page and position can't overlap in time");
ok(!(await fails(slot(PINE, 2, 10, 40))), "slots: another position on the same page is fine");
ok(
  await fails(slot(QUILL, 3, 5, 6)),
  "slots: one agency can't hold two positions on a page at once",
);
ok(
  !(await fails(slot(SALT, 1, 31, 60))),
  "slots: same position after the previous one ends is fine",
);
ok(!(await fails(slot(SALT, 1, 0, 10, "2"))), "slots: same position on a different page is fine");
ok(
  !(await fails(slot(PINE, 1, 0, 5, "null"))) && (await fails(slot(SALT, 1, 2, 3, "null"))),
  "slots: hub pages (no industry) are checked too",
);
ok(await fails(slot(SALT, 3, 0, 5, "1", "1")), "slots: a page is industry or location, not both");
ok(await fails(slot(SALT, 4, 100, 101)), "slots: max 3 positions");

// agencies.is_verified follows approved verifications.
const verified = async (id) =>
  (await rows(`select is_verified from agencies where id = '${id}'`))[0].is_verified;
await db.exec(
  `update verifications set status = 'approved' where agency_id = '${PINE}' and status = 'requested'`,
);
ok((await verified(PINE)) === true, "verification: approving sets the agency's badge");
await db.exec(`update verifications set status = 'rejected' where agency_id = '${PINE}'`);
ok((await verified(PINE)) === false, "verification: revoking clears the badge");
const drift = await rows(
  `select a.slug from agencies a where a.is_verified <> exists (select 1 from verifications v where v.agency_id = a.id and v.status = 'approved')`,
);
ok(
  drift.length === 0,
  `verification: every badge matches an approved verification${drift.length ? " — drift: " + drift.map((d) => d.slug).join(", ") : ""}`,
);

console.log("— admin agencies list view (§5.2) —");
for (const [role, uid, who] of [
  ["anon", null, "anon"],
  ["authenticated", OWNER, "owner"],
  ["authenticated", ADMIN, "admin user (service role only)"],
]) {
  await as(role, uid, async () => {
    ok(await denied("select * from admin_agency_list"), `admin_agency_list: ${who} can't read it`);
  });
}
await db.exec("reset role");
const [quillRow] = await rows(
  `select plan, leads_30d, service_ids from admin_agency_list where id = '${QUILL}'`,
);
ok(quillRow.plan === "founding", "admin_agency_list: current plan from the active subscription");
ok(quillRow.leads_30d >= 2, "admin_agency_list: counts leads routed in the last 30 days");
ok(
  Array.isArray(quillRow.service_ids) && quillRow.service_ids.length > 0,
  "admin_agency_list: service ids as an array",
);
const [saltRow] = await rows(`select plan from admin_agency_list where id = '${SALT}'`);
ok(saltRow.plan === "free", "admin_agency_list: no subscription reads as free");
await db.exec(
  `update lead_routes set sent_at = now() - interval '31 days' where agency_id = '${QUILL}'`,
);
ok(
  (await rows(`select leads_30d from admin_agency_list where id = '${QUILL}'`))[0].leads_30d === 0,
  "admin_agency_list: older leads drop out of the 30-day count",
);
await db.exec("set role service_role");
ok(
  !(await denied("select id from admin_agency_list limit 1")),
  "admin_agency_list: the service role can read it",
);
await db.exec("reset role");

await db.exec("reset role");
const rlsOff = await rows(
  `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
);
ok(
  rlsOff.length === 0,
  `RLS enabled on every public table${rlsOff.length ? " — missing: " + rlsOff.map((r) => r.relname).join(", ") : ""}`,
);

// updated_at triggers (sitemap lastmod)
const OLD = "2000-01-01T00:00:00Z";
const ts = async (sql) => new Date((await rows(sql))[0].updated_at).getTime();
const stale = new Date(OLD).getTime();
await db.exec(`insert into service_industry_content (service_id, industry_id, intro) values (1, 2, 'x') on conflict do nothing;
  update service_industry_content set updated_at = '${OLD}' where service_id = 1 and industry_id = 2;`);
await db.exec(
  `update service_industry_content set intro = 'edited' where service_id = 1 and industry_id = 2`,
);
ok(
  (await ts(
    "select updated_at from service_industry_content where service_id = 1 and industry_id = 2",
  )) > stale,
  "service_industry_content.updated_at set on edit",
);
for (const t of ["services", "industries"]) {
  await db.exec(
    `update ${t} set updated_at = '${OLD}' where id = 1; update ${t} set intro = 'edited' where id = 1;`,
  );
  ok((await ts(`select updated_at from ${t} where id = 1`)) > stale, `${t}.updated_at set on edit`);
}
const agencyTs = () => ts("select updated_at from agencies where slug = 'pinecask-creative'");
const resetAgency = () =>
  db.exec(`update agencies set updated_at = '${OLD}' where slug = 'pinecask-creative'`);
// set_updated_at fires on this reset too, so the stale value is written with triggers bypassed:
await db.exec("alter table agencies disable trigger set_updated_at");
await resetAgency();
await db.exec("alter table agencies enable trigger set_updated_at");
await db.exec(
  "insert into case_studies (agency_id, title) select id, 'New case study' from agencies where slug = 'pinecask-creative'",
);
ok((await agencyTs()) > stale, "new case study bumps the agency's updated_at");
await db.exec("alter table agencies disable trigger set_updated_at");
await resetAgency();
await db.exec("alter table agencies enable trigger set_updated_at");
await db.exec(
  "insert into reviews (agency_id, author_name, rating, body) select id, 'Pending', 4, 'A pending review that is long enough to pass.' from agencies where slug = 'pinecask-creative'",
);
ok((await agencyTs()) === stale, "pending review does NOT bump the agency (not shown publicly)");
await db.exec("update reviews set status = 'published' where author_name = 'Pending'");
ok((await agencyTs()) > stale, "publishing a review bumps the agency");
await db.exec("alter table agencies disable trigger set_updated_at");
await resetAgency();
await db.exec("alter table agencies enable trigger set_updated_at");
await db.exec(
  "delete from agency_locations where agency_id = (select id from agencies where slug = 'pinecask-creative')",
);
ok((await agencyTs()) > stale, "removing a location bumps the agency");
await db.exec("alter table agencies disable trigger set_updated_at");
await resetAgency();
await db.exec("alter table agencies enable trigger set_updated_at");
await db.exec("update agencies set description = 'edited' where slug = 'pinecask-creative'");
ok((await agencyTs()) > stale, "editing the agency sets its updated_at");

// Rate limiter: 6th hit refused, and expired rows for any key are pruned (privacy policy claim).
const hit = async (k) =>
  (await db.query(`select hit_rate_limit($1, 5, '1 hour') ok`, [k])).rows[0].ok;
const hits = [];
for (let i = 0; i < 6; i++) hits.push(await hit("ip:audit"));
ok(hits.join() === "true,true,true,true,true,false", "rate limit: 6th hit in an hour refused");
await db.exec(
  `insert into rate_limits (key, created_at) values ('email:stale', now() - interval '3 hours')`,
);
await hit("ip:other");
ok(
  (await rows("select * from rate_limits where key = 'email:stale'")).length === 0,
  "rate limit: expired rows of other keys pruned",
);
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exitCode = failures ? 1 : 0;
