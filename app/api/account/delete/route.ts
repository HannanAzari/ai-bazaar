import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/server-session";
import { createSupabaseAdminClient, NESTUDIO_BUCKET } from "@/lib/supabase/admin";

// ── M23B §2 — real account deletion ──────────────────────────────────────────
//
// D-09 says: if the cascade cannot be completed safely, do NOT fake it. So this route
// either performs the whole cascade or refuses with an honest reason — it never returns
// 200 for a partial deletion.
//
// The cascade, in dependency order:
//   1. private avatar objects in Storage  (not covered by any DB cascade)
//   2. the creator's own social rows      (likes / comments / follows they authored)
//   3. notifications they caused          (actor_id has ON DELETE SET NULL, so the row
//                                          would otherwise survive as a ghost)
//   4. auth.users                         (Postgres then cascades: profiles → nests →
//                                          nest_objects → user_avatars, all of which
//                                          declare ON DELETE CASCADE)
//
// The service-role key is used ONLY here, on the server. It is never sent to the client.
//
// Auth: the caller can delete exactly one account — their own. There is no id parameter,
// by design: the id comes from the verified session, so this route cannot be pointed at
// somebody else.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await getServerUser();
  if ("status" in auth) {
    return auth.status === "unconfigured"
      ? NextResponse.json({ error: "Account deletion is unavailable: the server is not configured." }, { status: 503 })
      : NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    // Honest refusal rather than a fake success — the button stays, the lie doesn't.
    return NextResponse.json(
      { error: "Account deletion is unavailable on this deployment (SUPABASE_SERVICE_ROLE_KEY is not set). Nothing was changed." },
      { status: 503 },
    );
  }

  const userId = auth.user.id;

  try {
    // 1. Private storage — enumerate the user's own prefix and remove what's there.
    //    Storage has no foreign key to auth.users, so nothing else will ever clean this up.
    const { data: files, error: listErr } = await admin.storage.from(NESTUDIO_BUCKET).list(`avatars/${userId}`, { limit: 1000 });
    if (listErr && !/not found/i.test(listErr.message)) {
      return NextResponse.json({ error: `Could not read your private files, so nothing was deleted: ${listErr.message}` }, { status: 500 });
    }
    if (files?.length) {
      const paths = files.map((f) => `avatars/${userId}/${f.name}`);
      const { error: rmErr } = await admin.storage.from(NESTUDIO_BUCKET).remove(paths);
      if (rmErr) {
        return NextResponse.json({ error: `Could not delete your private files, so nothing was deleted: ${rmErr.message}` }, { status: 500 });
      }
    }

    // 2 + 3. Rows that survive the auth cascade because they point AT the user rather
    //        than being owned by them. Missing-table errors are tolerated (a project
    //        where the social migration has not been applied still deletes cleanly).
    const sweeps: { table: string; column: string }[] = [
      { table: "nest_likes", column: "user_id" },
      { table: "nest_comments", column: "user_id" },
      { table: "creator_follows", column: "follower_id" },
      { table: "creator_follows", column: "creator_id" },
      { table: "notifications", column: "actor_id" },
      { table: "notifications", column: "user_id" },
    ];
    for (const { table, column } of sweeps) {
      const { error } = await admin.from(table).delete().eq(column, userId);
      // PGRST205 = table not in the schema cache (not provisioned); 42P01 = undefined_table.
      if (error && error.code !== "PGRST205" && error.code !== "42P01") {
        return NextResponse.json(
          { error: `Could not clear your ${table} rows, so your account was NOT deleted: ${error.message}` },
          { status: 500 },
        );
      }
    }

    // 4. The account itself. Postgres cascades profiles → nests → nest_objects → avatars.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return NextResponse.json({ error: `Your account could not be deleted: ${delErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected failure.";
    console.error("[account/delete] cascade failed:", e);
    return NextResponse.json({ error: `Your account could not be deleted: ${message}` }, { status: 500 });
  }
}
