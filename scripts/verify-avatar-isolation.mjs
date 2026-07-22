#!/usr/bin/env node
/**
 * SECTION 7 — cross-user isolation proof with TWO real authenticated test users.
 * Creates two throwaway users (admin API), proves RLS isolation on user_avatars + the
 * private bucket with their real sessions, then DELETES both users and all test data.
 *
 *   node scripts/verify-avatar-isolation.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
function loadEnv() {
  const env = { ...process.env };
  try { for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()); if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
  return env;
}
const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL, anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const BUCKET = "avatar-private";

let pass = 0, fail = 0;
const ok = (label, cond, detail = "") => { console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`); cond ? pass++ : fail++; };
const rnd = Math.random().toString(36).slice(2, 8);
const users = {};

async function makeUser(tag) {
  const email = `avatar-sectest-${tag}-${rnd}@nestudio-test.invalid`;
  const password = `Test-${rnd}-${tag}-pw!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: s, error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw new Error(`signIn ${tag}: ${sErr.message}`);
  return { id: data.user.id, email, client, token: s.session.access_token };
}

try {
  console.log(`▶ Avatar cross-user isolation → ${url.replace(/^https?:\/\//, "")}\n`);
  users.a = await makeUser("a");
  users.b = await makeUser("b");
  ok("two real auth users signed in", !!users.a.token && !!users.b.token, `A=${users.a.id.slice(0, 8)}… B=${users.b.id.slice(0, 8)}…`);

  // User A creates an owner-scoped avatar row + a private source object under A's folder.
  const aKey = `${users.a.id}/isolation-${rnd}/source.txt`;
  const upA = await users.a.client.storage.from(BUCKET).upload(aKey, Buffer.from("A-private-source"), { contentType: "text/plain" });
  ok("user A can write to their own private folder", !upA.error, upA.error?.message);
  const insA = await users.a.client.from("user_avatars").insert({ owner_id: users.a.id, title: "A avatar", source_private_url: aKey, active: true, status: "approved" }).select("id").single();
  ok("user A can insert their own avatar row", !insA.error, insA.error?.message);
  const aRowId = insA.data?.id;

  // User A can read their own row + file (owner access works).
  const aReadOwn = await users.a.client.from("user_avatars").select("id").eq("id", aRowId);
  ok("user A can read their own avatar row", !aReadOwn.error && aReadOwn.data?.length === 1);
  const aDl = await users.a.client.storage.from(BUCKET).download(aKey);
  ok("user A can read their own private source", !aDl.error);

  // ── Isolation: user B must NOT see/modify A's data ──
  const bReadRows = await users.b.client.from("user_avatars").select("id");
  ok("user B cannot read A's avatar record (RLS)", !bReadRows.error && (bReadRows.data ?? []).every((r) => r.id !== aRowId), `B sees ${bReadRows.data?.length ?? 0} rows`);
  const bReadOne = await users.b.client.from("user_avatars").select("id").eq("id", aRowId);
  ok("user B cannot read A's row even by id", !bReadOne.error && (bReadOne.data?.length ?? 0) === 0);
  const bDownload = await users.b.client.storage.from(BUCKET).download(aKey);
  ok("user B cannot read A's private source file", !!bDownload.error, bDownload.error ? "denied" : "LEAKED");
  const bUpdate = await users.b.client.from("user_avatars").update({ title: "hacked" }).eq("id", aRowId).select("id");
  ok("user B cannot update A's row (0 affected)", !bUpdate.error && (bUpdate.data?.length ?? 0) === 0);
  const bDelete = await users.b.client.from("user_avatars").delete().eq("id", aRowId).select("id");
  ok("user B cannot delete A's row (0 affected)", !bDelete.error && (bDelete.data?.length ?? 0) === 0);

  // Confirm A's row + file survived B's attempts.
  const stillThere = await admin.from("user_avatars").select("title").eq("id", aRowId).single();
  ok("A's row intact after B's attempts", !stillThere.error && stillThere.data?.title === "A avatar", stillThere.data?.title);

  // Anonymous cannot read rows.
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const anonRows = await anon.from("user_avatars").select("id");
  ok("anonymous cannot read any avatar record", !anonRows.error && (anonRows.data?.length ?? 0) === 0);
} catch (e) {
  console.error("✗ test error:", e.message); fail++;
} finally {
  // Cleanup: remove rows, storage, and the test users.
  for (const u of Object.values(users)) {
    if (!u?.id) continue;
    await admin.from("user_avatars").delete().eq("owner_id", u.id);
    const { data: list } = await admin.storage.from(BUCKET).list(u.id, { limit: 100 });
    // best-effort recursive-ish cleanup of the probe folder
    await admin.storage.from(BUCKET).remove([`${u.id}/isolation-${rnd}/source.txt`]);
    await admin.auth.admin.deleteUser(u.id);
  }
  console.log("  · cleaned up test users + data");
  console.log(`\n${fail === 0 ? "✓ ISOLATION PROVEN" : "✗ ISOLATION FAILURE"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 2);
}
