#!/usr/bin/env node
/**
 * SECTION 1 — verify the LIVE Avatar private infrastructure before any generation/write.
 * Read-only + one temp private object (created then deleted) to prove the bucket is private.
 *
 *   node scripts/verify-avatar-infra.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) { console.error("✗ missing supabase env"); process.exit(1); }

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const BUCKET = "avatar-private";
let pass = 0, fail = 0;
const ok = (label, cond, detail = "") => { console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`); cond ? pass++ : fail++; };

console.log(`▶ Avatar infra verification → ${url.replace(/^https?:\/\//, "")}\n`);

// 1) user_avatars is REST-accessible (service-role select succeeds).
{
  const { error, count } = await admin.from("user_avatars").select("id", { count: "exact", head: true });
  ok("public.user_avatars is REST-accessible", !error, error ? error.message : `rows=${count ?? 0}`);
}

// 2) user_avatars columns present (select the contract columns).
{
  const { error } = await admin.from("user_avatars")
    .select("id,owner_id,title,source_private_url,output_private_url,public_profile_url,editor_asset_url,active,pose,style_version,metadata,generation_history,cost,status,created_at,deleted_at")
    .limit(1);
  ok("user_avatars has the full contract schema", !error, error ? error.message : "all columns present");
}

// 3) avatar-private bucket exists and is genuinely PRIVATE.
{
  const { data, error } = await admin.storage.getBucket(BUCKET);
  ok(`bucket '${BUCKET}' exists`, !error && !!data, error ? error.message : "");
  ok(`bucket '${BUCKET}' is PRIVATE (public=false)`, !!data && data.public === false, data ? `public=${data.public}` : "");
}

// 4) RLS on user_avatars: anonymous (anon key, no session) reads ZERO rows (owner-only policy).
{
  const { data, error } = await anon.from("user_avatars").select("id").limit(5);
  ok("anonymous read of user_avatars is blocked by RLS", (!error && (data?.length ?? 0) === 0), error ? `error: ${error.message}` : `rows=${data?.length ?? 0}`);
}

// 5) Private-bucket proof: put a temp object (service-role), then confirm anonymous public URL does NOT serve it.
{
  const key = `__verify__/probe-${Math.random().toString(36).slice(2)}.txt`;
  const up = await admin.storage.from(BUCKET).upload(key, Buffer.from("probe"), { contentType: "text/plain", upsert: true });
  if (up.error) { ok("temp private object created", false, up.error.message); }
  else {
    const publicUrl = admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
    const res = await fetch(publicUrl).catch(() => null);
    ok("anonymous access to a private object FAILS", !!res && !res.ok, res ? `HTTP ${res.status} on public URL (expected 4xx)` : "fetch blocked");
    // Signed URL (server-side) DOES work → owner-scoped server access is possible.
    const signed = await admin.storage.from(BUCKET).createSignedUrl(key, 30);
    const sres = signed.data?.signedUrl ? await fetch(signed.data.signedUrl).catch(() => null) : null;
    ok("server-side signed URL grants access", !!sres && sres.ok, sres ? `HTTP ${sres.status}` : "no signed url");
    await admin.storage.from(BUCKET).remove([key]);
    console.log("  · cleaned up temp probe object");
  }
}

console.log(`\n${fail === 0 ? "✓ ALL INFRA CHECKS PASSED" : "✗ SOME CHECKS FAILED"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 2);
