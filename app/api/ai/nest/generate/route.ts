import { NextResponse } from "next/server";
import { assertFounder } from "@/lib/founder-gate";
import { createSupabaseAdminClient, NESTUDIO_BUCKET } from "@/lib/supabase/admin";
import { NEST_DNA_VERSION, NEST_GEN_SIZE } from "@/lib/nest-factory/nest-dna";

// The Nest Generator — the ONLY thing that differs from Asset Factory. Empty rooms
// are TEXT-TO-IMAGE (no cutout/edit pass): OpenAI images/generations with the frozen
// Nest DNA prompt at the canonical portrait size. Server-only + founder-gated. The raw
// output persists to Supabase Storage (not the ephemeral FS); the inline data URL is
// always returned so review works even if Storage is briefly unreachable.

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENAI_IMAGE_MODEL = "gpt-image-1";
const OPENAI_PRICE = { textIn: 5, imageIn: 10, imageOut: 40 } as const; // USD / 1M tokens

type OpenAIUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
};

type Body = {
  positive?: string;
  negative?: string;
  id?: string;
  quality?: "high" | "medium" | "low" | "auto";
};

function estimateCost(usage?: OpenAIUsage): number | null {
  if (!usage) return null;
  const textIn = usage.input_tokens_details?.text_tokens ?? 0;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  const cost = (textIn * OPENAI_PRICE.textIn + imageIn * OPENAI_PRICE.imageIn + out * OPENAI_PRICE.imageOut) / 1_000_000;
  return Math.round(cost * 10000) / 10000;
}

function safeId(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "nest";
}

export async function POST(request: Request) {
  const gate = assertFounder(request);
  if (gate) return gate;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const positive = (body.positive ?? "").trim();
  if (!positive) return NextResponse.json({ error: "positive prompt is required" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set.", configured: false }, { status: 501 });

  const id = safeId(body.id || "nest");
  const prompt = body.negative ? `${positive}\n\nAvoid entirely: ${body.negative}` : positive;

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: prompt.slice(0, 32000),
        size: NEST_GEN_SIZE,
        quality: body.quality ?? "high",
        background: "opaque", // a solid room, not transparency
        n: 1,
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: `Nest generation failed: ${(err as Error).message}` }, { status: 502 });
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    return NextResponse.json({ error: `OpenAI HTTP ${res.status}: ${text}` }, { status: 502 });
  }

  const json = (await res.json()) as { data?: { b64_json?: string }[]; usage?: OpenAIUsage };
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) return NextResponse.json({ error: "No image returned by OpenAI" }, { status: 502 });

  // Persist the raw output to Supabase Storage (durable), not the Vercel filesystem.
  const key = `references/nests/${id}.png`;
  let storageUrl: string | null = null;
  let persisted = false;
  const admin = createSupabaseAdminClient();
  if (admin) {
    const up = await admin.storage.from(NESTUDIO_BUCKET).upload(key, Buffer.from(b64, "base64"), { contentType: "image/png", upsert: true });
    if (!up.error) {
      storageUrl = admin.storage.from(NESTUDIO_BUCKET).getPublicUrl(key).data.publicUrl ?? null;
      persisted = Boolean(storageUrl);
    }
  }

  return NextResponse.json({
    ok: true,
    id,
    imageDataUrl: `data:image/png;base64,${b64}`,
    storageUrl,
    persisted,
    model: OPENAI_IMAGE_MODEL,
    dnaVersion: NEST_DNA_VERSION,
    size: NEST_GEN_SIZE,
    costUsd: estimateCost(json.usage),
  });
}
