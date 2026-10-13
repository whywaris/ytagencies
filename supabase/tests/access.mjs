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
  -- As on Supabase: service_role bypasses RLS and gets the same default grants.
  create role anon; create role authenticated; create role service_role bypassrls;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
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
// Not the seed's sample prefix (00000000-0000-4000-8000-…), which the seed deletes.
const FOUNDING_X = "f0000000-0000-4000-8000-000000000001";
const noExt = (sql) => sql.replace('create extension if not exists "pgcrypto";', "");
if (MIGRATIONS) {
  // Existing-project path: the initial schema, then every migration in order.
  const initial = execFileSync("git", ["show", `${INITIAL_SCHEMA_COMMIT}:supabase/schema.sql`], {
    cwd: root,
    encoding: "utf8",
  });
  await db.exec(noExt(initial));
  for (const f of readdirSync(root + "supabase/migrations").sort()) {
    // A Founding agency as it existed before Pro-only, to check the conversion keeps its access.
    if (f.includes("pro_only"))
      await db.exec(`insert into agencies (id, slug, name) values ('${FOUNDING_X}', 'founding-x', 'Founding X');
        insert into agency_subscriptions (agency_id, plan_id, status, starts_at, ends_at, source)
          values ('${FOUNDING_X}', 'founding', 'active', now(), now() + interval '90 days', 'founding');`);
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
    (await rows("select id from reviews where status <> 'published'")).length === 0,
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
  ok(
    !(await denied(
      submit(
        SUB(1),
        ", min_budget_usd, pricing_model, min_contract, ad_spend, setup_fee_usd",
        ", 2000, 'per_video', '3_months', 'separate', 500",
      ),
    )),
    "can insert a draft they submitted, with its pricing details",
  );
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
  delete from agency_subscriptions where agency_id <> '${FOUNDING_X}'; -- the seed's samples; these tests set their own
  insert into auth.users (id, email) values ('${ADMIN}', 'admin@x.example');
  update profiles set role = 'admin' where id = '${ADMIN}';
  insert into agency_subscriptions (agency_id, plan_id, source, ends_at)
    values ('${QUILL}', 'pro', 'manual', now() + interval '6 months'),
           ('${PINE}', 'pro', 'manual', null);
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
await db.query(`select record_agency_event($1, 'website_click', '/', 'v9', 'directory')`, [QUILL]);
await db.query(`select record_agency_event($1, 'website_click', '/agency/x', 'v8', 'profile')`, [
  QUILL,
]);
const clicks = await rows(
  `select source, count from agency_event_daily where agency_id = '${QUILL}' and type = 'website_click' order by source`,
);
ok(
  JSON.stringify(clicks) ===
    JSON.stringify([
      { source: "directory", count: 1 },
      { source: "profile", count: 1 },
    ]),
  "events: website clicks are rolled up by source",
);
ok(
  await denied(`select record_agency_event('${QUILL}', 'website_click', '/', 'v7', 'email')`),
  "events: unknown click source refused",
);
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
  ok((await rows("select * from plans")).length === 1, "owner: plans readable (Pro)");
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
      `insert into agency_subscriptions (agency_id, plan_id, source) values ('${QUILL}', 'pro', 'manual')`,
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
    (await rows(`select * from agency_subscriptions where agency_id <> '${FOUNDING_X}'`)).length ===
      2,
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
    `insert into agency_subscriptions (agency_id, plan_id, source) values ('${QUILL}', 'pro', 'manual')`,
  ),
  "subscriptions: one active row per agency",
);
ok(
  !(await fails(
    `insert into agency_subscriptions (agency_id, plan_id, status, source) values ('${QUILL}', 'pro', 'expired', 'manual')`,
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

console.log("— guides CMS (§8) —");
await db.exec(`reset role;
  insert into guides (slug, title, status, published_at) values
    ('draft-guide', 'Draft', 'draft', null),
    ('future-guide', 'Future', 'scheduled', now() + interval '1 day'),
    ('due-guide', 'Due', 'scheduled', now() - interval '1 minute');
  insert into guide_redirects (from_slug, guide_id) select 'old-live', id from guides where slug = 'youtube-ads-agency-cost';
  insert into guide_redirects (from_slug, guide_id) select 'old-future', id from guides where slug = 'future-guide';`);
ok(
  await fails("insert into guides (slug, title, status) values ('no-date', 'X', 'published')"),
  "guides: published needs a date",
);
ok(
  await fails("insert into guides (slug, title) values ('Bad Slug', 'X')"),
  "guides: slugs are lowercase kebab-case",
);
for (const [role, uid, who] of [
  ["anon", null, "anon"],
  ["authenticated", OWNER, "signed-in user"],
]) {
  await as(role, uid, async () => {
    const slugs = (await rows("select slug from guides order by slug")).map((r) => r.slug);
    ok(
      slugs.includes("youtube-ads-agency-cost"),
      `guides: ${who} reads the migrated published guide`,
    );
    ok(
      slugs.includes("due-guide"),
      `guides: ${who} reads a scheduled guide once its time has passed`,
    );
    ok(
      !slugs.includes("draft-guide") && !slugs.includes("future-guide"),
      `guides: ${who} can't read drafts or future guides`,
    );
    const redirects = (await rows("select from_slug from guide_redirects")).map((r) => r.from_slug);
    ok(
      redirects.includes("old-live") && !redirects.includes("old-future"),
      `guide_redirects: ${who} only sees redirects to live guides`,
    );
    ok(
      await denied("insert into guides (slug, title) values ('sneaky', 'Sneaky')"),
      `guides: ${who} can't write`,
    );
    ok(await denied("update guides set title = 'x'"), `guides: ${who} can't edit`);
    ok(
      await denied(
        "insert into guide_redirects (from_slug, guide_id) select 'hijack', id from guides limit 1",
      ),
      `guide_redirects: ${who} can't add redirects`,
    );
  });
}
await as("authenticated", ADMIN, async () => {
  ok(
    (await rows("select slug from guides where slug in ('draft-guide', 'future-guide')")).length ===
      2,
    "guides: admin reads drafts and future guides",
  );
  ok(
    !(await denied("update guides set title = 'Draft edited' where slug = 'draft-guide'")),
    "guides: admin can edit",
  );
});
const [migrated] = await rows(
  "select body_md, related_combos from guides where slug = 'youtube-ads-agency-cost'",
);
ok(
  migrated.body_md.includes("{{budget-range youtube-ads-agencies}}") &&
    !migrated.body_md.includes("<BudgetRange"),
  "guides: MDX component migrated to the allowlisted shortcode",
);
ok(
  Array.isArray(migrated.related_combos) &&
    migrated.related_combos.length === 3 &&
    migrated.related_combos.every((c) => Number.isInteger(c.service_id)),
  "guides: related directory pages migrated with real ids",
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
ok(quillRow.plan === "pro", "admin_agency_list: current plan from the active subscription");
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

console.log("— guide authors and in_review —");
await db.exec(`reset role;
  insert into authors (slug, name) values ('draft-only', 'Draft Only'), ('no-guides', 'No Guides');
  update guides set author_id = (select id from authors where slug = 'draft-only') where slug = 'draft-guide';
  insert into guides (slug, title, status) values ('in-review-guide', 'In review', 'in_review');`);
ok(
  (
    await rows(
      "select a.slug from guides g join authors a on a.id = g.author_id where g.slug = 'youtube-ads-agency-cost'",
    )
  )[0]?.slug === "editorial-team",
  "authors: the migrated guide belongs to the default author",
);
ok(
  await fails("insert into guides (slug, title, status) values ('bad-status', 'X', 'pending')"),
  "guides: unknown statuses are refused",
);
ok(
  await fails(
    "insert into guides (slug, title, key_takeaways) values ('six', 'X', array['1','2','3','4','5','6'])",
  ),
  "guides: at most 5 key takeaways",
);
for (const [role, uid, who] of [
  ["anon", null, "anon"],
  ["authenticated", OWNER, "signed-in user"],
]) {
  await as(role, uid, async () => {
    const slugs = (await rows("select slug from authors")).map((r) => r.slug);
    ok(slugs.includes("editorial-team"), `authors: ${who} reads an author with a live guide`);
    ok(
      !slugs.includes("draft-only") && !slugs.includes("no-guides"),
      `authors: ${who} can't read authors without a live guide`,
    );
    ok(await denied("select user_id from authors"), `authors: ${who} can't read user_id`);
    ok(
      await denied("insert into authors (slug, name) values ('sneaky', 'Sneaky')"),
      `authors: ${who} can't write`,
    );
    ok(await denied("update authors set name = 'x'"), `authors: ${who} can't edit`);
    ok(
      !(await rows("select slug from guides")).some((r) => r.slug === "in-review-guide"),
      `guides: ${who} can't read guides in review`,
    );
  });
}
await as("authenticated", ADMIN, async () => {
  ok((await rows("select slug from authors")).length >= 3, "authors: admin reads every author");
  ok(
    (await db.query("update authors set bio = 'Writes guides.' where slug = 'no-guides'"))
      .affectedRows === 1,
    "authors: admin can edit",
  );
});
ok(
  await fails(`update authors set bio = '${"x".repeat(301)}' where slug = 'no-guides'`),
  "authors: bio is capped at 300 characters",
);
ok(
  await fails("update authors set x_url = 'javascript:alert(1)' where slug = 'no-guides'"),
  "authors: social links must be https",
);

console.log("— contact messages —");
await db.exec(
  "insert into contact_messages (topic, name, email, message) values ('privacy', 'Ana', 'ana@x.example', 'Please delete my inquiry.')",
);
ok(
  await fails(
    "insert into contact_messages (topic, name, email, message) values ('sales', 'X', 'x@x.example', 'Hi')",
  ),
  "contact_messages: unknown topics are refused",
);
for (const [role, uid, who] of [
  ["anon", null, "anon"],
  ["authenticated", OWNER, "signed-in user"],
]) {
  await as(role, uid, async () => {
    ok(await denied("select * from contact_messages"), `contact_messages: ${who} can't read`);
    ok(
      await denied(
        "insert into contact_messages (topic, name, email, message) values ('general', 'X', 'x@x.example', 'Hi')",
      ),
      `contact_messages: ${who} can't insert directly`,
    );
    ok(
      await denied("update contact_messages set status = 'closed'"),
      `contact_messages: ${who} can't change status`,
    );
    ok(await denied("delete from contact_messages"), `contact_messages: ${who} can't delete`);
  });
}
await as("authenticated", ADMIN, async () => {
  ok((await rows("select * from contact_messages")).length === 1, "contact_messages: admin reads");
  ok(
    (await db.query("update contact_messages set status = 'closed', closed_at = now()"))
      .affectedRows === 1,
    "contact_messages: admin can close",
  );
  ok(
    (await db.query("delete from contact_messages")).affectedRows === 1,
    "contact_messages: admin can delete",
  );
});

console.log("— agency delete —");
{
  const target = (
    await rows("select id, name, slug from agencies where owner_id is not null limit 1")
  )[0];
  const owner = (await rows(`select owner_id from agencies where id = '${target.id}'`))[0].owner_id;
  await db.exec(`reset role;
    insert into leads (id, name, email) values ('99999999-9999-4999-8999-999999999999', 'Kept Lead', 'kept@x.example');
    insert into lead_routes (lead_id, agency_id) values ('99999999-9999-4999-8999-999999999999', '${target.id}');`);
  await as("authenticated", owner, async () => {
    ok(
      await denied(`delete from agencies where id = '${target.id}'`),
      "agencies: an owner can't delete their own agency",
    );
    ok(
      await fails(`select * from delete_agencies(array['${target.id}']::uuid[])`),
      "delete_agencies: owners can't run it",
    );
  });
  await as("anon", null, async () => {
    ok(
      await fails(`select * from delete_agencies(array['${target.id}']::uuid[])`),
      "delete_agencies: anon can't run it",
    );
  });
  await as("authenticated", OWNER, async () => {
    ok(
      await fails(`select * from delete_agencies(array['${target.id}']::uuid[])`),
      "delete_agencies: signed-in users can't run it",
    );
    ok(
      await denied("select * from deleted_agency_routes"),
      "deleted_agency_routes: signed-in users can't read",
    );
  });
  await db.exec("reset role; set role service_role;");
  const deleted = await rows(`select * from delete_agencies(array['${target.id}']::uuid[])`);
  await db.exec("reset role;");
  ok(
    deleted.length === 1 && deleted[0].slug === target.slug,
    "delete_agencies: returns the deleted agency",
  );
  ok(
    (await rows(`select 1 from agencies where id = '${target.id}'`)).length === 0,
    "delete_agencies: the agency is gone",
  );
  ok(
    (await rows("select 1 from leads where id = '99999999-9999-4999-8999-999999999999'")).length ===
      1,
    "delete_agencies: the agency's leads are kept",
  );
  ok(
    (await rows(`select 1 from lead_routes where agency_id = '${target.id}'`)).length === 0,
    "delete_agencies: its lead routes are removed",
  );
  const history = await rows(
    "select agency_name from deleted_agency_routes where lead_id = '99999999-9999-4999-8999-999999999999'",
  );
  ok(
    history[0]?.agency_name === target.name,
    "delete_agencies: the lead keeps the agency's name as history",
  );
  for (const table of [
    "case_studies",
    "agency_services",
    "agency_industries",
    "agency_locations",
    "reviews",
    "claims",
    "verifications",
    "agency_subscriptions",
    "agency_events",
    "agency_event_daily",
  ]) {
    ok(
      (await rows(`select 1 from ${table} where agency_id = '${target.id}'`)).length === 0,
      `delete_agencies: ${table} rows are removed`,
    );
  }
  await as("authenticated", ADMIN, async () => {
    ok(
      (await rows("select * from deleted_agency_routes")).length >= 1,
      "deleted_agency_routes: admin reads",
    );
  });
}

console.log("— settings (§5.10) —");
for (const [role, uid, who] of [
  ["anon", null, "anon"],
  ["authenticated", OWNER, "signed-in user"],
]) {
  await as(role, uid, async () => {
    ok(await denied("select * from app_settings"), `app_settings: ${who} can't read`);
    ok(
      await denied("update app_settings set updated_at = now()"),
      `app_settings: ${who} can't edit`,
    );
  });
}
await as("authenticated", ADMIN, async () => {
  ok(
    (await rows("select * from app_settings")).length === 1,
    "app_settings: admin reads the one row",
  );
  ok(
    (await db.query("update app_settings set updated_at = now()")).affectedRows === 1,
    "app_settings: admin can edit",
  );
  ok(
    await denied("insert into app_settings (id) values (true)"),
    "app_settings: admin can't add a second row",
  );
  ok(await denied("delete from app_settings"), "app_settings: admin can't delete the row");
});
ok(
  await fails("insert into app_settings (id) values (false)"),
  "app_settings: only one row is possible",
);

console.log("— Pro-only (migration 20261020000100) —");
if (MIGRATIONS) {
  const [converted] = await rows(
    `select plan_id, source, status, ends_at > now() + interval '89 days' as kept from agency_subscriptions where agency_id = '${FOUNDING_X}'`,
  );
  ok(
    converted?.plan_id === "pro" &&
      converted.source === "manual" &&
      converted.status === "active" &&
      converted.kept === true,
    "migration: a Founding subscription becomes Pro (manual) with the same end date",
  );
}
ok(
  JSON.stringify(await rows("select id, price_monthly::int m, price_yearly::int y from plans")) ===
    JSON.stringify([{ id: "pro", m: 29, y: 279 }]),
  "plans: only Pro, $29 / $279",
);
ok(
  await fails(
    `insert into agency_subscriptions (agency_id, plan_id, source) values ('${SALT}', 'founding', 'founding')`,
  ),
  "subscriptions: no Founding plan or source any more",
);
ok(
  await fails(
    `insert into agency_subscriptions (agency_id, plan_id, source, status) values ('${SALT}', 'pro', 'manual', 'past_due')`,
  ),
  "subscriptions: past_due needs past_due_since",
);
await db.exec(
  `delete from agency_subscriptions where agency_id = '${SALT}'; insert into agency_subscriptions (agency_id, plan_id, source) values ('${SALT}', 'pro', 'manual')`,
);
ok(
  await fails(
    `insert into agency_subscriptions (agency_id, plan_id, source, status, past_due_since) values ('${SALT}', 'pro', 'manual', 'past_due', now())`,
  ),
  "subscriptions: one live (active or past due) subscription per agency",
);
ok(
  await fails(`select founding_open from app_settings`),
  "app_settings: Founding programme fields are gone",
);

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

console.log("— response time (lead_routes.contacted_at, agency_response_times) —");
// Quillfern was deleted by the agency-delete tests above: Saltmere is OWNER's agency here.
const MINE = SALT;
await db.exec(
  `reset role; update agencies set owner_id = '${OWNER}', status = 'published' where id = '${MINE}'`,
);
const R = (n) => `bbbbbbbb-0000-4000-8000-00000000000${n}`;
await db.exec(`reset role;
  insert into leads (id, name, email) select ('bbbbbbbb-0000-4000-8000-00000000000' || n)::uuid, 'R' || n, 'r' || n || '@x.example' from generate_series(1, 7) n;
  insert into lead_routes (lead_id, agency_id, sent_at) values
    ('${R(1)}', '${MINE}', now() - interval '3 hours'),
    ('${R(2)}', '${MINE}', now() - interval '2 hours'),
    ('${R(3)}', '${MINE}', now() - interval '1 hour'),
    ('${R(4)}', '${PINE}', now() - interval '3 days'),
    ('${R(5)}', '${PINE}', now() - interval '3 days'),
    ('${R(6)}', '${PINE}', now() - interval '3 days'),
    ('${R(7)}', '${PINE}', now() - interval '1 hour');`);
const route = async (n) =>
  (await rows(`select contacted_at from lead_routes where lead_id = '${R(n)}'`))[0];
const markAs = (n, extra = "contacted_at = now()") =>
  `update lead_routes set ${extra} where lead_id = '${R(n)}' returning 1`;
await as("authenticated", OWNER, async () => {
  ok(
    !(await denied(markAs(1, "contacted_at = '2000-01-01'"))),
    "owner: can mark their own routed lead as contacted",
  );
  ok(await denied(markAs(7)), "owner: can't mark another agency's lead");
  ok(await denied(markAs(2, "sent_at = now()")), "owner: can't change sent_at");
  ok(await denied(markAs(2, "reminded_at = now()")), "owner: can't change reminded_at");
});
const first = await route(1);
ok(
  Date.now() - new Date(first.contacted_at).getTime() < 60_000,
  "contacted_at is the server's time, never the one sent (no backdating)",
);
await as("authenticated", OWNER, async () => {
  await db.query(markAs(1, "contacted_at = now() + interval '1 day'"));
});
ok(
  new Date((await route(1)).contacted_at).getTime() === new Date(first.contacted_at).getTime(),
  "contacted_at is set once",
);
await as("authenticated", OTHER, async () => {
  ok(await denied(markAs(2)), "other user: can't mark someone else's lead");
});
await as("anon", null, async () => {
  ok(await denied(markAs(2)), "anon: can't mark a lead");
});
ok(
  (await rows(`select 1 from agency_response_times where agency_id = '${MINE}'`)).length === 0,
  "response time: hidden with fewer than 3 contacted leads",
);
await as("authenticated", OWNER, async () => {
  await db.query(markAs(2));
  await db.query(markAs(3));
});
for (const n of [4, 5, 6]) await db.query(markAs(n));
await as("anon", null, async () => {
  const shown = await rows("select * from agency_response_times");
  const quill = shown.find((r) => r.agency_id === MINE);
  ok(
    quill?.contacted === 3 && Math.abs(quill.median_minutes - 120) <= 1,
    "response time: median of 3 contacted leads (2 hours), readable by anon",
  );
  ok(
    Object.keys(quill ?? {})
      .sort()
      .join() === "agency_id,contacted,median_minutes",
    "response time: the view exposes only the aggregate",
  );
  ok(
    !shown.some((r) => r.agency_id === PINE),
    "response time: hidden when the median is 2 days or more",
  );
  ok(
    (await rows("select min_contract, ad_spend, setup_fee_usd from agencies limit 1")).length === 1,
    "anon: pricing details are readable",
  );
});

console.log("— retention (lib/retention.ts deletes old leads; their routes must go too) —");
await db.exec(`reset role;
  insert into leads (id, name, email, created_at) values ('cccccccc-0000-4000-8000-000000000001', 'Old', 'old@x.example', now() - interval '25 months');
  insert into lead_routes (lead_id, agency_id) values ('cccccccc-0000-4000-8000-000000000001', '${PINE}');
  insert into deleted_agency_routes (lead_id, agency_id, agency_name, agency_slug, sent_at)
    values ('cccccccc-0000-4000-8000-000000000001', gen_random_uuid(), 'Gone', 'gone', now() - interval '25 months');
  delete from leads where created_at < now() - interval '24 months';`);
ok(
  (await rows("select 1 from lead_routes where lead_id = 'cccccccc-0000-4000-8000-000000000001'"))
    .length === 0 &&
    (
      await rows(
        "select 1 from deleted_agency_routes where lead_id = 'cccccccc-0000-4000-8000-000000000001'",
      )
    ).length === 0,
  "retention: deleting an old lead removes its lead_routes and deleted_agency_routes rows",
);
ok(
  (await rows("select 1 from leads where created_at >= now() - interval '24 months'")).length > 0,
  "retention: newer leads are kept",
);

console.log("— agency profile data (migration 20261019000100) —");
const DRAFT = "00000000-0000-4000-8000-000000000099";
await as("authenticated", OWNER, async () => {
  ok(
    !(await denied(
      `update agencies set best_for = 'Gaming brands', reporting_frequency = 'weekly', process = '[{"title":"Audit","description":"We review your channel"}]' where id = '${MINE}' returning 1`,
    )),
    "owner: can edit best_for, reporting frequency and process",
  );
  ok(
    await denied(`update agencies set seo_title = 'x' where id = '${MINE}' returning 1`),
    "owner: can't write seo_title",
  );
  ok(
    await denied(`update agencies set seo_description = 'x' where id = '${MINE}' returning 1`),
    "owner: can't write seo_description",
  );
  ok(
    await denied(
      `update agencies set process = '[{},{},{},{},{},{}]' where id = '${MINE}' returning 1`,
    ),
    "process: at most 5 steps",
  );
  ok(
    !(await denied(
      `update agency_services set focus_pct = 60, included = '{"Scripts","Editing"}', starting_price = 1500, price_unit = 'project' where agency_id = '${MINE}' returning 1`,
    )),
    "owner: can set focus, included and price on their services",
  );
  ok(
    await denied(
      `update agency_services set included = '{"a","b","c","d","e","f","g"}' where agency_id = '${MINE}' returning 1`,
    ),
    "services: at most 6 included items",
  );

  // Channels
  ok(
    !(await denied(
      `insert into agency_channels (agency_id, channel_url) values ('${MINE}', 'https://www.youtube.com/@one') returning 1`,
    )),
    "channels: owner can add one to their agency",
  );
  ok(
    await denied(
      `insert into agency_channels (agency_id, channel_url) values ('${PINE}', 'https://www.youtube.com/@x') returning 1`,
    ),
    "channels: owner can't add one to another agency",
  );
  ok(
    await denied(
      `insert into agency_channels (agency_id, channel_url, status) values ('${MINE}', 'https://www.youtube.com/@two', 'confirmed') returning 1`,
    ),
    "channels: owner can't insert with status",
  );
  ok(
    await denied(
      `update agency_channels set status = 'confirmed' where agency_id = '${MINE}' returning 1`,
    ),
    "channels: owner can't set status",
  );
  ok(
    await denied(
      `update agency_channels set confirmed_at = now() where agency_id = '${MINE}' returning 1`,
    ),
    "channels: owner can't set confirmed_at",
  );
  ok(
    await denied(
      `update agency_channels set subscriber_count = 9999999 where agency_id = '${MINE}' returning 1`,
    ),
    "channels: owner can't write subscriber counts",
  );
});
await db.exec(
  `reset role; update agency_channels set status = 'confirmed', confirmed_at = now(), channel_id = 'UC_x5XG1OV2P6uZZ5FSM9Ttw' where agency_id = '${MINE}'`,
);
await as("authenticated", OWNER, async () => {
  await db.query(
    `update agency_channels set channel_url = 'https://www.youtube.com/@renamed' where agency_id = '${MINE}'`,
  );
  for (let n = 2; n <= 6; n++)
    await db.query(
      `insert into agency_channels (agency_id, channel_url) values ('${MINE}', 'https://www.youtube.com/@c${n}')`,
    );
  ok(
    await denied(
      `insert into agency_channels (agency_id, channel_url) values ('${MINE}', 'https://www.youtube.com/@c7') returning 1`,
    ),
    "channels: at most 6 per agency",
  );
  ok(
    !(await denied(
      `delete from agency_channels where agency_id = '${MINE}' and channel_url = 'https://www.youtube.com/@c6' returning 1`,
    )),
    "channels: owner can delete their own",
  );
});
const [renamed] = await rows(
  `select status, confirmed_at, channel_id from agency_channels where channel_url = 'https://www.youtube.com/@renamed'`,
);
ok(
  renamed?.status === "listed" && renamed.confirmed_at === null && renamed.channel_id === null,
  "channels: a changed link loses its confirmation and resolved data",
);
await db.exec(
  `reset role; insert into agency_channels (agency_id, channel_url) values ('${DRAFT}', 'https://www.youtube.com/@draft')`,
);
await as("anon", null, async () => {
  ok(
    (await rows(`select 1 from agency_channels where agency_id = '${MINE}'`)).length === 5,
    "channels: anon reads a published agency's channels",
  );
  ok(
    (await rows(`select 1 from agency_channels where agency_id = '${DRAFT}'`)).length === 0,
    "channels: anon can't read a draft agency's channels",
  );
  ok(
    await denied(
      `insert into agency_channels (agency_id, channel_url) values ('${MINE}', 'https://www.youtube.com/@anon') returning 1`,
    ),
    "channels: anon can't add",
  );
});

// Reviews
await db.exec(`reset role;
  insert into reviews (agency_id, author_name, rating, body, status, score_quality, score_schedule, score_cost, score_refer, lead_id)
  values ('${MINE}', 'Verified Reviewer', 5, 'A review with the new scores for the access test.', 'published', 5, 4.5, 4, 5, 'bbbbbbbb-0000-4000-8000-000000000001');`);
const [scored] = await rows(
  "select overall, verified_client from reviews where author_name = 'Verified Reviewer'",
);
ok(
  Number(scored?.overall) === 4.63 && scored.verified_client === true,
  "reviews: overall is the average of the four scores, verified_client follows lead_id",
);
ok(
  await fails(`update reviews set score_cost = 4.3 where author_name = 'Verified Reviewer'`),
  "reviews: scores are in half steps from 1 to 5",
);
await as("anon", null, async () => {
  ok(await denied("select lead_id from reviews limit 1"), "reviews: anon can't read lead_id");
  ok(
    (await rows("select overall, verified_client from reviews where status = 'published'")).length >
      0,
    "reviews: anon reads scores and verified_client of published reviews",
  );
});

// Seeded case-study metrics are stored as up to 3 {value, label}.
const [cs] = await rows(
  `select metrics from case_studies where metrics @> '[{"label":"ROAS"}]' and metrics @> '[{"label":"Revenue"}]'`,
);
ok(
  JSON.stringify(cs?.metrics) ===
    JSON.stringify([
      { label: "Revenue", value: "$640,000" },
      { label: "ROAS", value: "4.1×" },
    ]),
  "case studies: object metrics converted to {value, label} (formatted, acronyms kept)",
);
ok(
  await fails(
    `update case_studies set metrics = '[{"value":"1","label":"a"},{"value":"2","label":"b"},{"value":"3","label":"c"},{"value":"4","label":"d"}]' where id = (select id from case_studies limit 1)`,
  ),
  "case studies: at most 3 metrics",
);
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exitCode = failures ? 1 : 0;
