import { NextResponse } from "next/server";

// M21 — server-only bridge to the hosted image model (Google Gemini), matching
// the repo's existing pattern (scripts/generate-p0-pilot.mjs): the key is read
// from GEMINI_API_KEY and sent via the x-goog-api-key header — NEVER a URL, never
// the browser. The client `geminiProvider` posts here; the engine falls back to
// the local Canvas provider when this returns 501 (no key). Same AIImageProvider
// interface either way, so nothing else changes.
//
// This is the ONE place real generation happens; the Admin Asset Factory will
// call the same route server-side.

const MODEL = "gemini-3.1-flash-image"; // per M9.2 pilot

type Body = { imageDataUrl?: string; positive?: string; negative?: string; size?: number };

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Not an error the user caused — the hosted provider simply isn't configured.
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set — using the local provider.", configured: false },
      { status: 501 },
    );
  }

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

  const prompt = body.negative ? `${body.positive}\n\nAvoid: ${body.negative}` : body.positive;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "1:1" },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      return NextResponse.json({ error: `Gemini HTTP ${res.status}: ${text}` }, { status: 502 });
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      return NextResponse.json({ error: "No image returned by the model" }, { status: 502 });
    }
    const mime = part.inlineData.mimeType ?? "image/png";
    return NextResponse.json({
      imageDataUrl: `data:${mime};base64,${part.inlineData.data}`,
      provider: "gemini",
      model: MODEL,
    });
  } catch (err) {
    return NextResponse.json({ error: `Gemini request failed: ${(err as Error).message}` }, { status: 502 });
  }
}
