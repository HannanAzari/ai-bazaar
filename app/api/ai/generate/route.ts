import { NextResponse } from "next/server";

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

type Body = { provider?: string; imageDataUrl?: string; extraImages?: string[]; positive?: string; negative?: string; size?: number };

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
async function generateOpenAI(apiKey: string, parsed: { mimeType: string; data: string }, prompt: string) {
  // gpt-image-1 edits take a PNG < 4MB + a prompt and reinterpret it. Sizes are
  // constrained; we request 1024² and let the client finish/resize to the DNA size.
  const bytes = Buffer.from(parsed.data, "base64");
  const blob = new Blob([bytes], { type: parsed.mimeType });
  const form = new FormData();
  form.append("model", OPENAI_IMAGE_MODEL);
  form.append("image", blob, "cutout.png");
  form.append("prompt", prompt.slice(0, 4000));
  form.append("size", "1024x1024");
  form.append("n", "1");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    return { error: `OpenAI HTTP ${res.status}: ${text}`, status: 502 as const };
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) return { error: "No image returned by OpenAI", status: 502 as const };
  return { imageDataUrl: `data:image/png;base64,${b64}`, model: OPENAI_IMAGE_MODEL };
}

export async function POST(request: Request) {
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
      const out = await generateOpenAI(apiKey, parsed, prompt);
      if ("error" in out) return NextResponse.json({ error: out.error }, { status: out.status });
      return NextResponse.json({ ...out, provider: "gpt-image" });
    }
    return NextResponse.json({ error: `Provider "${provider}" is not configured on the server.`, configured: false }, { status: 501 });
  } catch (err) {
    return NextResponse.json({ error: `${provider} request failed: ${(err as Error).message}` }, { status: 502 });
  }
}
