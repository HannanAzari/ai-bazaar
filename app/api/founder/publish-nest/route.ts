import { NextResponse } from "next/server";
import { assertFounder } from "@/lib/founder-gate";
import { createSupabaseAdminClient, NESTUDIO_BUCKET } from "@/lib/supabase/admin";

// ── Founder-gated empty-Nest publish ─────────────────────────────────────────
//
// Publishes an approved empty Nest to the DEDICATED Nest Library (nest_backgrounds
// — NOT nest_assets). Same safety as publish-asset: founder-gated, service-role
// admin (secret server-only), image→Storage first then row (no partial published
// Nest), idempotent by id, refuses to overwrite a different title.
//
// Once written with status='approved', the Nest appears in getBackgrounds() →
// the editor's "Build My Own / Choose Empty Nest" chooser automatically.

export const runtime = "nodejs";
export const maxDuration = 60;

type PublishBody = {
  id?: string;
  title?: string;
  imageDataUrl?: string; // final room PNG
  style?: string; // architectural style → nest_backgrounds.style
  cameraDnaVersion?: string;
  tags?: string[]; // recommended asset tags
  metadata?: Record<string, unknown>; // mood, lighting, palette, walls, floor, dnaScore…
  status?: "approved" | "draft";
};

function safeId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "";
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

  // Never clobber a different curated Nest sharing this id.
  const { data: existing, error: readErr } = await admin
    .from("nest_backgrounds")
    .select("id,title,status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: `nest_backgrounds unreachable (provision it first): ${readErr.message}` }, { status: 503 });
  }
  if (existing && existing.title !== title) {
    return NextResponse.json(
      { error: `id '${id}' already exists with a different title ('${existing.title}'). Refusing to overwrite.` },
      { status: 409 },
    );
  }

  // Image → Storage first (durable), then the row.
  const key = `library-v1/nests/${id}.png`;
  const up = await admin.storage.from(NESTUDIO_BUCKET).upload(key, bytes, { contentType: "image/png", upsert: true });
  if (up.error) {
    return NextResponse.json({ error: `Storage upload failed: ${up.error.message}` }, { status: 502 });
  }
  const publicUrl = admin.storage.from(NESTUDIO_BUCKET).getPublicUrl(key).data.publicUrl;
  if (!publicUrl) {
    return NextResponse.json({ error: "No public URL from Storage — aborted before writing the row (no partial Nest)." }, { status: 502 });
  }

  const row = {
    id,
    slug: id,
    title,
    image_url: publicUrl,
    variants: { standard: publicUrl },
    style: (body.style || "").trim() || null,
    camera_dna_version: body.cameraDnaVersion || "front-facing-v1",
    tags: Array.isArray(body.tags) ? body.tags : [],
    metadata: body.metadata ?? {},
    status: body.status === "draft" ? "draft" : "approved",
    source_candidate_id: "founder-nest-factory",
  };
  const { error: upsertErr } = await admin.from("nest_backgrounds").upsert(row, { onConflict: "id" });
  if (upsertErr) {
    return NextResponse.json({ error: `Row upsert failed: ${upsertErr.message}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id, imageUrl: publicUrl, status: row.status });
}
