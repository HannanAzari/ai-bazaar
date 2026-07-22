import { NextResponse } from "next/server";
import { buildReferencePrompt, REFERENCE_STUDIO_VERSION, REFERENCE_SIZE } from "@/lib/asset-pipeline/reference-studio";
import { createSupabaseAdminClient, NESTUDIO_BUCKET } from "@/lib/supabase/admin";
import { requireFounder } from "@/lib/founder-role";

// Image generation can take up to a couple of minutes; ask Vercel for headroom
// (clamped down to the plan's ceiling if lower). Node runtime for Buffer + Storage.
export const runtime = "nodejs";
export const maxDuration = 300;

// The Reference Studio — the SECONDARY pipeline. Text-to-image (OpenAI images/generations,
// gpt-image-1) with the fixed studio prompt, so every object starts from the same visual
// language. Saves the result to /public/references/{id}.png as the reusable reference
// library, and returns the public path so the Asset Factory can consume it as its input.
//
// Server-only (OpenAI key + filesystem). Never faked: a missing key returns 501 honestly.

const OPENAI_IMAGE_MODEL = "gpt-image-1";
const OPENAI_PRICE = { textIn: 5, imageIn: 10, imageOut: 40 } as const; // USD per 1M tokens

type Body = { subject?: string; id?: string; quality?: "high" | "medium" | "low" | "auto" };

type OpenAIUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
};

function estimateCost(usage?: OpenAIUsage): number | null {
  if (!usage) return null;
  const textIn = usage.input_tokens_details?.text_tokens ?? 0;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  const cost = (textIn * OPENAI_PRICE.textIn + imageIn * OPENAI_PRICE.imageIn + out * OPENAI_PRICE.imageOut) / 1_000_000;
  return Math.round(cost * 10000) / 10000;
}

/** Slugify an id/subject into a safe filename stem. */
function safeId(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "reference"
  );
}

export async function POST(request: Request) {
  const gate = await requireFounder(request);
  if ("response" in gate) return gate.response;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const subject = (body.subject ?? "").trim();
  if (!subject) return NextResponse.json({ error: "subject is required" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set.", configured: false }, { status: 501 });

  const id = safeId(body.id || subject);
  const prompt = buildReferencePrompt(subject);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size: `${REFERENCE_SIZE}x${REFERENCE_SIZE}`,
        quality: body.quality ?? "high",
        background: "opaque", // a real studio white sweep, not transparency
        n: 1,
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: `Reference request failed: ${(err as Error).message}` }, { status: 502 });
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    return NextResponse.json({ error: `OpenAI HTTP ${res.status}: ${text}` }, { status: 502 });
  }

  const json = (await res.json()) as { data?: { b64_json?: string }[]; usage?: OpenAIUsage };
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) return NextResponse.json({ error: "No image returned by OpenAI" }, { status: 502 });

  // Persist to the reusable reference library in Supabase Storage — NOT the local
  // filesystem. Vercel's /public is read-only at runtime and its FS is ephemeral, so
  // a disk write would either fail or vanish. Storage is the durable source of truth.
  // If Storage is unreachable we still return the inline image (persisted:false) so a
  // single generation is never lost — but nothing partial is written.
  const key = `references/${id}.png`;
  let publicUrl: string | null = null;
  let persisted = false;
  const admin = createSupabaseAdminClient();
  if (admin) {
    const up = await admin.storage
      .from(NESTUDIO_BUCKET)
      .upload(key, Buffer.from(b64, "base64"), { contentType: "image/png", upsert: true });
    if (!up.error) {
      publicUrl = admin.storage.from(NESTUDIO_BUCKET).getPublicUrl(key).data.publicUrl ?? null;
      persisted = Boolean(publicUrl);
    }
  }

  return NextResponse.json({
    ok: true,
    id,
    // Public Storage URL when persisted; the inline data URL is always present so the
    // Asset Factory can consume the reference immediately regardless.
    path: publicUrl ?? `data:image/png;base64,${b64}`,
    storageUrl: publicUrl,
    persisted,
    imageDataUrl: `data:image/png;base64,${b64}`,
    model: OPENAI_IMAGE_MODEL,
    version: REFERENCE_STUDIO_VERSION,
    costUsd: estimateCost(json.usage),
  });
}
