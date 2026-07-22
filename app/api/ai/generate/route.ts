import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertFounder } from "@/lib/founder-gate";

export const runtime = "nodejs";
export const maxDuration = 300;

// M32 — server-only bridge to the hosted image models, now provider-routed. The
// client asset-pipeline adapters POST `{ provider, imageDataUrl, positive, negative,
// size }`; this route dispatches to the right model with the right server-side key
// (NEVER a URL, never the browser). Same response shape for every provider, so the
// rest of Nestudio stays provider-agnostic. Returns 501 when the chosen provider has
// no key (the adapter surfaces that honestly; nothing is faked).
//
// Providers: `gemini` (GEMINI_API_KEY) · `gpt-image`/`openai` (OPENAI_API_KEY).

const GEMINI_MODEL = "gemini-3.1-flash-image"; // per M9.2 pilot
const OPENAI_IMAGE_MODEL = "gpt-image-1";

// gpt-image-1 token pricing (USD per 1M tokens) — for a truthful cost estimate.
const OPENAI_PRICE = { textIn: 5, imageIn: 10, imageOut: 40 } as const;

type Body = {
  provider?: string;
  imageDataUrl?: string;
  extraImages?: string[];
  positive?: string;
  negative?: string;
  size?: number;
  /** GPT Image: "high" preserves input detail/identity; "low" is looser. */
  inputFidelity?: "high" | "low";
  /** GPT Image render quality. */
  quality?: "high" | "medium" | "low" | "auto";
  /** M36 P5 — attach the official Nestudio furniture as STYLE references. */
  styleRefs?: boolean;
};

// M36 P5 — a small, diverse set of official Nestudio furniture (fabric, wood, metal,
// ceramic + greenery) attached as STYLE references so GPT Image learns the house look.
// Curated small on purpose: more images = more input tokens + identity-bleed risk.
const STYLE_REF_FILES = [
  "public/nests/library-v1/assets/ast-lr-sofa-boucle.webp",
  "public/nests/library-v1/assets/ast-lr-table-oak-round.webp",
  "public/nests/library-v1/assets/ast-floor-lamp.webp",
  "public/nests/library-v1/assets/ast-side-plant.webp",
];

async function loadStyleRefs(): Promise<{ mimeType: string; data: string }[]> {
  const out: { mimeType: string; data: string }[] = [];
  for (const rel of STYLE_REF_FILES) {
    try {
      const buf = await readFile(path.join(process.cwd(), rel));
      out.push({ mimeType: "image/webp", data: buf.toString("base64") });
    } catch {
      /* a missing ref just means one fewer style hint — never fail the generation */
    }
  }
  return out;
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

/* ── Gemini ──────────────────────────────────────────────────────────────────── */
async function generateGemini(apiKey: string, parsed: { mimeType: string; data: string }, prompt: string, extras: { mimeType: string; data: string }[] = []) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  // Identity Lock: the cutout first, then the original photo + mask as references.
  const parts = [
    { text: prompt },
    { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
    ...extras.map((e) => ({ inlineData: { mimeType: e.mimeType, data: e.data } })),
  ];
  const payload = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    return { error: `Gemini HTTP ${res.status}: ${text}`, status: 502 as const };
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) return { error: "No image returned by Gemini", status: 502 as const };
  const mime = part.inlineData.mimeType ?? "image/png";
  return { imageDataUrl: `data:${mime};base64,${part.inlineData.data}`, model: GEMINI_MODEL };
}

/* ── OpenAI GPT Image (images/edits) ─────────────────────────────────────────── */
type OpenAIUsage = {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
};

/** Truthful cost estimate from the returned token usage (null if unavailable). */
function estimateOpenAICost(usage?: OpenAIUsage): number | null {
  if (!usage) return null;
  const textIn = usage.input_tokens_details?.text_tokens ?? 0;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  const cost = (textIn * OPENAI_PRICE.textIn + imageIn * OPENAI_PRICE.imageIn + out * OPENAI_PRICE.imageOut) / 1_000_000;
  return Math.round(cost * 10000) / 10000;
}

async function generateOpenAI(
  apiKey: string,
  parsed: { mimeType: string; data: string },
  prompt: string,
  extras: { mimeType: string; data: string }[],
  styleRefs: { mimeType: string; data: string }[],
  opts: { inputFidelity: "high" | "low"; quality: "high" | "medium" | "low" | "auto" },
) {
  // gpt-image-1 edits: the clean cutout is the primary image; the original photo goes in
  // as an ADDITIONAL reference so the model sees detail the cutout lost; the official
  // furniture STYLE refs (P5) come last (the prompt marks them style-only). `background:
  // transparent` gives true alpha natively; `input_fidelity: high` preserves identity.
  // We request 1024² and let the client trim/pad to the DNA export size — no destructive post.
  const form = new FormData();
  form.append("model", OPENAI_IMAGE_MODEL);
  const toBlob = (p: { mimeType: string; data: string }, name: string): [Blob, string] => [
    new Blob([Buffer.from(p.data, "base64")], { type: p.mimeType }),
    name,
  ];
  // Primary + references, all under the array field `image[]` (gpt-image-1 accepts multiple,
  // capped at 16). Order: object cutout · object references · official style references.
  form.append("image[]", ...toBlob(parsed, "object.png"));
  extras.slice(0, 2).forEach((e, i) => form.append("image[]", ...toBlob(e, `object-ref-${i}.png`)));
  styleRefs.slice(0, 6).forEach((e, i) => form.append("image[]", ...toBlob(e, `style-ref-${i}.webp`)));
  form.append("prompt", prompt.slice(0, 32000));
  form.append("size", "1024x1024");
  form.append("background", "transparent");
  form.append("input_fidelity", opts.inputFidelity);
  form.append("quality", opts.quality);
  form.append("n", "1");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    return { error: `OpenAI HTTP ${res.status}: ${text}`, status: 502 as const };
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[]; usage?: OpenAIUsage };
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) return { error: "No image returned by OpenAI", status: 502 as const };
  return {
    imageDataUrl: `data:image/png;base64,${b64}`,
    model: OPENAI_IMAGE_MODEL,
    usage: json.usage,
    costUsd: estimateOpenAICost(json.usage),
  };
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
  if (!body.imageDataUrl || !body.positive) {
    return NextResponse.json({ error: "imageDataUrl and positive prompt are required" }, { status: 400 });
  }
  const parsed = parseDataUrl(body.imageDataUrl);
  if (!parsed) {
    return NextResponse.json({ error: "imageDataUrl must be a base64 image data URL" }, { status: 400 });
  }

  const provider = (body.provider ?? "gemini").toLowerCase();
  const prompt = body.negative ? `${body.positive}\n\nAvoid: ${body.negative}` : body.positive;
  const extras = (body.extraImages ?? [])
    .map(parseDataUrl)
    .filter((x): x is { mimeType: string; data: string } => !!x)
    .slice(0, 3);

  try {
    if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is not set.", configured: false }, { status: 501 });
      const out = await generateGemini(apiKey, parsed, prompt, extras);
      if ("error" in out) return NextResponse.json({ error: out.error }, { status: out.status });
      return NextResponse.json({ ...out, provider: "gemini" });
    }
    if (provider === "gpt-image" || provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set.", configured: false }, { status: 501 });
      const styleRefs = body.styleRefs === false ? [] : await loadStyleRefs();
      const out = await generateOpenAI(apiKey, parsed, prompt, extras, styleRefs, {
        inputFidelity: body.inputFidelity ?? "high",
        quality: body.quality ?? "high",
      });
      if ("error" in out) return NextResponse.json({ error: out.error }, { status: out.status });
      return NextResponse.json({ ...out, provider: "gpt-image", styleRefCount: styleRefs.length });
    }
    return NextResponse.json({ error: `Provider "${provider}" is not configured on the server.`, configured: false }, { status: 501 });
  } catch (err) {
    return NextResponse.json({ error: `${provider} request failed: ${(err as Error).message}` }, { status: 502 });
  }
}
