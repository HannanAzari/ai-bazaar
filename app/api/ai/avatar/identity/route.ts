import { NextResponse } from "next/server";
import { requireAvatarAccess } from "@/lib/user-gate";
import { buildIdentityCapturePrompt, AVATAR_IDENTITY_VERSION } from "@/lib/avatar-factory/identity";

// Stage 1 · Identity Capture — the user's photo → ONE head-and-shoulders identity candidate.
// Authenticated as the real USER (avatar Beta). The photo is used in memory only; NOTHING is
// written to storage here — durable ownership/source persistence happens at freeze/publish into
// the PRIVATE bucket (same honest pattern as /generate). The candidate is never published.

export const runtime = "nodejs";
export const maxDuration = 120;

const OPENAI_IMAGE_MODEL = "gpt-image-1";
const OPENAI_PRICE = { textIn: 5, imageIn: 10, imageOut: 40 } as const;
// Head-and-shoulders reads best in a portrait crop; square would waste the body region.
const IDENTITY_SIZE = "1024x1536";

type OpenAIUsage = { output_tokens?: number; input_tokens_details?: { text_tokens?: number; image_tokens?: number } };
type Body = { imageDataUrl?: string };

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
  const parsed = body.imageDataUrl ? parseDataUrl(body.imageDataUrl) : null;
  if (!parsed) return NextResponse.json({ error: "imageDataUrl (the original photo) is required" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set.", configured: false }, { status: 501 });

  const { positive, negative } = buildIdentityCapturePrompt();
  const prompt = `${positive}\n\nAvoid entirely: ${negative}`;

  try {
    const form = new FormData();
    form.append("model", OPENAI_IMAGE_MODEL);
    form.append("image[]", new Blob([Buffer.from(parsed.data, "base64")], { type: parsed.mimeType }), "person.png");
    form.append("prompt", prompt.slice(0, 32000));
    form.append("size", IDENTITY_SIZE);
    form.append("background", "transparent");
    form.append("input_fidelity", "high"); // resemblance is the whole job of Stage 1
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
    if (!b64) return NextResponse.json({ error: "No identity candidate returned by OpenAI" }, { status: 502 });

    return NextResponse.json({
      ok: true,
      // Owner-scoped candidate: returned to the signed-in user only; not persisted, not public.
      ownerId: gate.user.id,
      identityDataUrl: `data:image/png;base64,${b64}`,
      model: OPENAI_IMAGE_MODEL,
      identityVersion: AVATAR_IDENTITY_VERSION,
      size: IDENTITY_SIZE,
      costUsd: estimateCost(json.usage),
    });
  } catch (err) {
    return NextResponse.json({ error: `identity capture failed: ${(err as Error).message}` }, { status: 502 });
  }
}
