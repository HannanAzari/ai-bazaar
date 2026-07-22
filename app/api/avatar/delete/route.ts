import { NextResponse } from "next/server";
import { requireUser } from "@/lib/user-gate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Avatar deletion — removes/revokes ALL traces for the AUTHENTICATED USER: source photo,
// generated output (private + public copies), the catalog record, and the profile
// reference if this was the active avatar. RLS (owner-only) guarantees a user can only
// delete their own avatar.

export const runtime = "nodejs";
export const maxDuration = 60;

const PRIVATE_BUCKET = "avatar-private";
const PUBLIC_BUCKET = "avatars";

type Body = { id?: string };

export async function POST(request: Request) {
  const gate = await requireUser();
  if ("response" in gate) return gate.response;
  const uid = gate.user.id;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Auth not configured.", configured: false }, { status: 503 });

  let body: Body;
  try { body = (await request.json()) as Body; } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "avatar id is required." }, { status: 400 });

  // RLS ensures this only returns the caller's own row.
  const { data: row, error: readErr } = await supabase
    .from("user_avatars")
    .select("id,owner_id,active,source_private_url,output_private_url,public_profile_url")
    .eq("id", body.id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: `Lookup failed: ${readErr.message}` }, { status: 503 });
  if (!row) return NextResponse.json({ error: "Avatar not found (or not yours)." }, { status: 404 });

  // Remove private objects.
  const privatePaths = [row.source_private_url, row.output_private_url].filter(Boolean) as string[];
  if (privatePaths.length) await supabase.storage.from(PRIVATE_BUCKET).remove(privatePaths);
  // Remove the public copy, if any (path is `<uid>/<id>.png`).
  await supabase.storage.from(PUBLIC_BUCKET).remove([`${uid}/${row.id}.png`]);

  // If it was the active profile avatar, clear the profile reference.
  if (row.active) await supabase.from("profiles").update({ avatar_url: null }).eq("id", uid);

  // Soft-delete the record (keeps an auditable tombstone; RLS owner-only).
  const { error: delErr } = await supabase
    .from("user_avatars")
    .update({ active: false, status: "archived", deleted_at: new Date().toISOString(), source_private_url: null, output_private_url: null, public_profile_url: null, editor_asset_url: null })
    .eq("id", row.id);
  if (delErr) return NextResponse.json({ error: `Delete failed: ${delErr.message}` }, { status: 502 });

  return NextResponse.json({ ok: true, id: row.id, deleted: true });
}
