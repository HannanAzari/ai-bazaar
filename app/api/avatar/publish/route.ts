import { NextResponse } from "next/server";
import { requireUser } from "@/lib/user-gate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Avatar publish — persists an approved avatar for the AUTHENTICATED USER. Uses the
// user's OWN session client so RLS enforces owner-only access end to end (NO service-role,
// so user A can never write as user B). Source + unpublished output → PRIVATE bucket; the
// active output → public `avatars` bucket + profiles.avatar_url. Fail-closed if the
// private bucket / user_avatars table are not yet provisioned.

export const runtime = "nodejs";
export const maxDuration = 60;

const PRIVATE_BUCKET = "avatar-private";
const PUBLIC_BUCKET = "avatars";

type Body = {
  displayName?: string;
  sourceDataUrl?: string; // the uploaded photo → private bucket
  outputDataUrl?: string; // the generated avatar → private (+ public if active)
  pose?: string;
  styleVersion?: string;
  metadata?: Record<string, unknown>;
  cost?: Record<string, unknown>;
  active?: boolean;
};

function parsePng(d?: string): Buffer | null {
  if (!d) return null;
  const m = /^data:image\/png;base64,(.+)$/.exec(d);
  try { return m ? Buffer.from(m[1], "base64") : null; } catch { return null; }
}
function parseAnyImage(d?: string): { buf: Buffer; ext: string } | null {
  if (!d) return null;
  const m = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/.exec(d);
  if (!m) return null;
  try { return { buf: Buffer.from(m[2], "base64"), ext: m[1].replace("jpeg", "jpg") }; } catch { return null; }
}

export async function POST(request: Request) {
  const gate = await requireUser();
  if ("response" in gate) return gate.response;
  const uid = gate.user.id;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Auth not configured.", configured: false }, { status: 503 });

  let body: Body;
  try { body = (await request.json()) as Body; } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const source = parseAnyImage(body.sourceDataUrl);
  const output = parsePng(body.outputDataUrl);
  if (!source) return NextResponse.json({ error: "sourceDataUrl (the uploaded photo) is required." }, { status: 400 });
  if (!output) return NextResponse.json({ error: "outputDataUrl (PNG avatar) is required." }, { status: 400 });

  // Fail-closed: the PRIVATE bucket must exist. Without it, refuse — never write a
  // person's source photo to a public bucket.
  const { data: bucket, error: bucketErr } = await supabase.storage.getBucket(PRIVATE_BUCKET);
  if (bucketErr || !bucket) {
    return NextResponse.json({ error: `Private bucket '${PRIVATE_BUCKET}' is not provisioned. Run user_avatars_provision.sql first.`, configured: false }, { status: 503 });
  }
  if (bucket.public) {
    return NextResponse.json({ error: `Bucket '${PRIVATE_BUCKET}' must be PRIVATE (public=false).` }, { status: 500 });
  }

  const avatarId = crypto.randomUUID();
  const base = `${uid}/${avatarId}`;

  // Source + output → PRIVATE bucket (owner-folder path; RLS enforces owner-only).
  const upSrc = await supabase.storage.from(PRIVATE_BUCKET).upload(`${base}/source.${source.ext}`, source.buf, { contentType: `image/${source.ext}`, upsert: false });
  if (upSrc.error) return NextResponse.json({ error: `Source upload failed: ${upSrc.error.message}` }, { status: 502 });
  const upOut = await supabase.storage.from(PRIVATE_BUCKET).upload(`${base}/output.png`, output, { contentType: "image/png", upsert: false });
  if (upOut.error) return NextResponse.json({ error: `Output upload failed: ${upOut.error.message}` }, { status: 502 });

  // Active → also publish the output to the PUBLIC bucket + set it as the profile avatar.
  let publicProfileUrl: string | null = null;
  const active = body.active !== false;
  if (active) {
    const upPub = await supabase.storage.from(PUBLIC_BUCKET).upload(`${base}.png`, output, { contentType: "image/png", upsert: true });
    if (upPub.error) return NextResponse.json({ error: `Public output upload failed: ${upPub.error.message}` }, { status: 502 });
    publicProfileUrl = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(`${base}.png`).data.publicUrl ?? null;
    // Only this user's active avatar; unique index enforces one active per owner.
    await supabase.from("user_avatars").update({ active: false }).eq("owner_id", uid).eq("active", true);
    if (publicProfileUrl) await supabase.from("profiles").update({ avatar_url: publicProfileUrl }).eq("id", uid);
  }

  const { data: row, error: insErr } = await supabase.from("user_avatars").insert({
    id: avatarId,
    owner_id: uid,
    title: (body.displayName || "My Avatar").slice(0, 40),
    source_private_url: `${base}/source.${source.ext}`,
    output_private_url: `${base}/output.png`,
    public_profile_url: publicProfileUrl,
    editor_asset_url: `${base}/output.png`,
    active,
    pose: body.pose || "idle-standing",
    style_version: body.styleVersion || "avatar-dna-v1",
    metadata: body.metadata ?? {},
    generation_history: [{ at: new Date().toISOString(), pose: body.pose || "idle-standing" }],
    cost: body.cost ?? {},
    status: "approved",
  }).select("id,active,status").single();
  if (insErr) return NextResponse.json({ error: `user_avatars insert failed (provision the table?): ${insErr.message}` }, { status: 503 });

  return NextResponse.json({ ok: true, id: row.id, active: row.active, publicProfileUrl });
}
