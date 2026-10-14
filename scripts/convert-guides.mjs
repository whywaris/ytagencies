// One-off: converts every guide still on Markdown (body_json is null) to Tiptap JSON + sanitized
// HTML. body_md is kept as the backup. Safe to run more than once: converted guides are skipped.
//   pnpm guides:convert            (reads .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from "@supabase/supabase-js";

import { docToHtml, markdownToDoc, sanitizeDoc } from "../src/lib/guide-content.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}
// Same rule as src/lib/guide-media.ts.
const storage = `${url}/storage/v1/object/public/`;
const allowed = (src) =>
  src.startsWith(`${storage}guide-media/`) || src.startsWith(`${storage}agency-media/guides/`);

const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.from("guides").select("id, slug, body_md").is("body_json", null);
if (error) {
  console.error("Couldn't read guides:", error.message);
  process.exit(1);
}
let done = 0;
for (const g of data) {
  const doc = sanitizeDoc(markdownToDoc(g.body_md ?? ""), allowed);
  const { error: e } = await db
    .from("guides")
    .update({ body_json: doc, body_html: docToHtml(doc, allowed) })
    .eq("id", g.id)
    .is("body_json", null);
  if (e) console.error(`✖ ${g.slug}: ${e.message}`);
  else done++;
}
console.log(`Converted ${done} of ${data.length} guide(s).`);
