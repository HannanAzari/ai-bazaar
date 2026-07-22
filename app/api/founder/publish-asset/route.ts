import { NextResponse } from "next/server";
import { assertFounder } from "@/lib/founder-gate";
import { createSupabaseAdminClient, NESTUDIO_BUCKET } from "@/lib/supabase/admin";

// ── Founder-gated global asset publish ───────────────────────────────────────
//
// The phone's Creation Studio calls this on Approve. It writes the approved asset
// to the canonical live catalog (Storage + nest_assets) with the SAME safety the
// offline scripts/upload-certified-asset.mjs enforces:
//   • Founder-gated (assertFounder) — anonymous callers get 401, never publish.
//   • Service-role admin client (server-only) — the secret never reaches the phone.
//   • Image uploaded to Storage FIRST; the row is written only once a real public
//     URL exists → an interrupted request never yields a partial PUBLISHED asset
//     (a published asset = a catalog row; an orphan Storage object is harmless).
//   • Idempotent by id (upsert, onConflict:id) → a double-tap can't duplicate.
//   • Refuses to overwrite a DIFFERENT existing asset (same id, different title).
//
// scope=global / ownerId=null are IMPLICIT: nest_assets is the global curated
// catalog. Ownership/version travel in visual_bounds (the M12 schema has no owner
// column — a documented limitation). Private-user assets will use a future path.

export const runtime = "nodejs";
export const maxDuration = 60;

type PublishBody = {
  id?: string;
  title?: string;
  category?: string;
  imageDataUrl?: string; // final transparent asset PNG
  compatibleSlotTypes?: string[];
  cameraDnaVersion?: string;
  tags?: string[];
  editableSurfaces?: unknown;
  visualBounds?: Record<string, unknown>;
  status?: "approved" | "draft";
};

function safeId(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || ""
  );
}

function parsePng(dataUrl: string): Buffer | null {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const gate = assertFounder(request);
  if (gate) return gate;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase admin is not configured on the server.", configured: false }, { status: 503 });
  }

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const id = safeId(body.id || title);
  const bytes = body.imageDataUrl ? parsePng(body.imageDataUrl) : null;
  if (!id) return NextResponse.json({ error: "A valid id or title is required." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title is required." }, { status: 400 });
  if (!bytes) return NextResponse.json({ error: "imageDataUrl must be a base64 PNG data URL." }, { status: 400 });

  // Safety: never clobber a different curated asset that happens to share this id.
  const { data: existing, error: readErr } = await admin
    .from("nest_assets")
    .select("id,title,status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: `nest_assets unreachable: ${readErr.message}` }, { status: 503 });
  }
  if (existing && existing.title !== title) {
    return NextResponse.json(
      { error: `id '${id}' already exists with a different title ('${existing.title}'). Refusing to overwrite.` },
      { status: 409 },
    );
  }

  // Upload image FIRST (durable in Storage), then the row.
  const key = `library-v1/${id}.png`;
  const up = await admin.storage.from(NESTUDIO_BUCKET).upload(key, bytes, { contentType: "image/png", upsert: true });
  if (up.error) {
    return NextResponse.json({ error: `Storage upload failed: ${up.error.message}` }, { status: 502 });
  }
  const publicUrl = admin.storage.from(NESTUDIO_BUCKET).getPublicUrl(key).data.publicUrl;
  if (!publicUrl) {
    return NextResponse.json({ error: "No public URL from Storage — aborted before writing the row (no partial asset)." }, { status: 502 });
  }

  const row = {
    id,
    slug: id,
    title,
    image_url: publicUrl,
    cutout_url: publicUrl,
    variants: { standard: publicUrl },
    category: (body.category || "object").trim(),
    compatible_slot_types: Array.isArray(body.compatibleSlotTypes) ? body.compatibleSlotTypes : [],
    editable_surfaces: body.editableSurfaces ?? [],
    visual_bounds: body.visualBounds ?? { aspect: "1:1", anchor: { x: 0.5, y: 1 }, scope: "global", ownerId: null, version: 1 },
    camera_dna_version: body.cameraDnaVersion || "front-facing-v1",
    status: body.status === "draft" ? "draft" : "approved",
    tags: Array.isArray(body.tags) ? body.tags : [],
    source_candidate_id: "founder-edition",
  };
  const { error: upsertErr } = await admin.from("nest_assets").upsert(row, { onConflict: "id" });
  if (upsertErr) {
    return NextResponse.json({ error: `Row upsert failed: ${upsertErr.message}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id, imageUrl: publicUrl, status: row.status });
}
