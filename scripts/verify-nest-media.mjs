#!/usr/bin/env node
// ── M27A — verify the nest-media bucket after applying the SQL ───────────────
//
// Run this AFTER `supabase/provision/m27a_media_storage.sql` has been applied. It checks,
// against the real project, the things the SQL is supposed to have made true:
//
//   1. the bucket exists, is public, and carries the size + MIME limits
//   2. an anonymous client can READ it (this is what a visitor does)
//   3. an anonymous client CANNOT write to it (the insert policy is `to authenticated`)
//
// It deliberately uses only the ANON key — the same credential the browser has. A
// service-role key would prove nothing about what a creator or a visitor can actually do,
// and must never be needed for this.
//
//     node scripts/verify-nest-media.mjs
//
// Exit code 0 = provisioned correctly. Non-zero = something to fix, with the reason.

import { readFileSync } from "node:fs";

const BUCKET = "nest-media";

function env() {
  let raw = "";
  for (const f of [".env.local", ".env"]) {
    try {
      raw += readFileSync(f, "utf8") + "\n";
    } catch {
      /* optional */
    }
  }
  const pick = (k) => new RegExp(`^${k}=(.*)$`, "m").exec(raw)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || pick("NEXT_PUBLIC_SUPABASE_URL");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    console.error("✗ No NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY found.");
    process.exit(2);
  }
  return { url: url.replace(/\/$/, ""), key };
}

const { url, key } = env();
const H = { apikey: key, Authorization: `Bearer ${key}` };
let failed = false;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => {
  failed = true;
  console.error(`✗ ${m}`);
};

console.log(`project: ${url}\n`);

// 1 — the bucket exists with the right shape.
const listed = await fetch(`${url}/storage/v1/bucket`, { headers: H });
const buckets = listed.ok ? await listed.json() : [];
const bucket = Array.isArray(buckets) ? buckets.find((b) => b.id === BUCKET || b.name === BUCKET) : null;

if (!bucket) {
  bad(`bucket "${BUCKET}" does NOT exist — apply supabase/provision/m27a_media_storage.sql`);
  console.error(`  (the project currently has ${Array.isArray(buckets) ? buckets.length : "?"} bucket(s))`);
  process.exit(1);
}
ok(`bucket "${BUCKET}" exists`);
bucket.public ? ok("bucket is public (visitors can read published media)") : bad("bucket is NOT public — visitors will not see media");
bucket.file_size_limit ? ok(`file size limit: ${(bucket.file_size_limit / 1048576).toFixed(0)} MB`) : bad("no file size limit set");

const mimes = bucket.allowed_mime_types ?? [];
for (const m of ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]) {
  mimes.includes(m) ? ok(`allows ${m}`) : bad(`does NOT allow ${m}`);
}
if (mimes.some((m) => m.startsWith("audio/"))) console.log("  note: audio types are allowed but the client does not offer audio yet (M27A §3).");

// 2 — anonymous READ works. This is exactly what an unauthenticated visitor does.
const read = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
  method: "POST",
  headers: { ...H, "Content-Type": "application/json" },
  body: JSON.stringify({ prefix: "", limit: 1 }),
});
read.ok ? ok("anonymous read allowed (visitor path)") : bad(`anonymous read blocked (${read.status}) — check nest_media_read`);

// 3 — anonymous WRITE is refused. The insert policy is `to authenticated`, so an
//     unauthenticated caller must not be able to put anything in the bucket.
const write = await fetch(`${url}/storage/v1/object/${BUCKET}/_verify/anon-should-fail.png`, {
  method: "POST",
  headers: { ...H, "Content-Type": "image/png" },
  body: new Uint8Array([137, 80, 78, 71]),
});
if (write.ok) {
  bad("anonymous WRITE succeeded — the insert policy is too permissive");
  await fetch(`${url}/storage/v1/object/${BUCKET}/_verify/anon-should-fail.png`, { method: "DELETE", headers: H });
} else {
  ok(`anonymous write refused (${write.status}) — only signed-in creators can upload`);
}

console.log(
  failed
    ? "\nRESULT: not provisioned correctly. Fix the items above."
    : "\nRESULT: nest-media is provisioned. Uploads should now work in the editor.",
);
process.exit(failed ? 1 : 0);
