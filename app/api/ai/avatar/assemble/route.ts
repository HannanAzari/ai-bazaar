import { NextResponse } from "next/server";
import { requireAvatarAccess } from "@/lib/user-gate";
import { AVATAR_GEN_SIZE } from "@/lib/avatar-factory/avatar-dna";
import { assembleReferences, AVATAR_BODY_VERSION } from "@/lib/avatar-factory/identity";

// Stage 2 · Character Assembly — dual-reference, image-to-image full-body avatar. Takes BOTH
// the ORIGINAL PHOTO (highest identity priority) and the APPROVED IDENTITY REFERENCE (the agreed
// Nestudio face/hair/material). Authenticated as the real USER (avatar Beta). In-memory only;
// nothing is written to storage here (persistence happens at publish). The one-shot /generate
// route is left untouched as the fallback path.

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENAI_IMAGE_MODEL = "gpt-image-1";
const OPENAI_PRICE = { textIn: 5, imageIn: 10, imageOut: 40 } as const;

type OpenAIUsage = { output_tokens?: number; input_tokens_details?: { text_tokens?: number; image_tokens?: number } };
type Body = { originalPhotoDataUrl?: string; identityDataUrl?: string; positive?: string; negative?: string };

function estimateCost(usage?: OpenAIUsage): number | null {
  if (!usage) return null;
  const textIn = usage.input_tokens_details?.text_tokens ?? 0;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  return Math.round(((textIn * OPENAI_PRICE.textIn + imageIn * OPENAI_PRICE.imageIn + out * OPENAI_PRICE.imageOut) / 1_000_000) * 10000) / 10000;
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

export async function POST(request: Request) {
  const gate = await requireAvatarAccess();
  if ("response" in gate) return gate.response;

  let body: Body;
  try { body = (await request.json()) as Body; } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  // BOTH references are required — the dual-reference contract (never a silent single-ref fallback).
  try {
    assembleReferences(body.originalPhotoDataUrl, body.identityDataUrl);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const original = parseDataUrl(body.originalPhotoDataUrl!);
  const identity = parseDataUrl(body.identityDataUrl!);
  if (!original || !identity) return NextResponse.json({ error: "Both references must be valid base64 images." }, { status: 400 });
  if (!body.positive) return NextResponse.json({ error: "positive prompt is required" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set.", configured: false }, { status: 501 });

  const prompt = body.negative ? `${body.positive}\n\nAvoid entirely: ${body.negative}` : body.positive;

  try {
    const form = new FormData();
    form.append("model", OPENAI_IMAGE_MODEL);
    // Order matters: original photo first (WHO / primary likeness), approved identity second (HOW).
    form.append("image[]", new Blob([Buffer.from(original.data, "base64")], { type: original.mimeType }), "original.png");
    form.append("image[]", new Blob([Buffer.from(identity.data, "base64")], { type: identity.mimeType }), "identity.png");
    form.append("prompt", prompt.slice(0, 32000));
    form.append("size", AVATAR_GEN_SIZE);
    form.append("background", "transparent");
    form.append("input_fidelity", "high");
    form.append("quality", "high");
    form.append("n", "1");

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST", headers: { authorization: `Bearer ${apiKey}` }, body: form,
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 500);
      return NextResponse.json({ error: `OpenAI HTTP ${res.status}: ${text}` }, { status: 502 });
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[]; usage?: OpenAIUsage };
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "No avatar returned by OpenAI" }, { status: 502 });

    return NextResponse.json({
      ok: true,
      ownerId: gate.user.id,
      imageDataUrl: `data:image/png;base64,${b64}`,
      model: OPENAI_IMAGE_MODEL,
      bodyVersion: AVATAR_BODY_VERSION,
      size: AVATAR_GEN_SIZE,
      mode: "two-stage",
      costUsd: estimateCost(json.usage),
    });
  } catch (err) {
    return NextResponse.json({ error: `character assembly failed: ${(err as Error).message}` }, { status: 502 });
  }
}
