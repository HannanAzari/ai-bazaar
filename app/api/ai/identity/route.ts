import { NextResponse } from "next/server";

// M36 P3 — rich identity extraction. BEFORE GPT Image runs, a vision model reads the
// selected object and returns a STRUCTURED identity: shape, materials, colours,
// decorative elements, text/logos, proportions — the difference between "blue candle"
// and "turquoise mosaic ceramic body · copper neck · Persian calligraphy label · slim
// white candle". furniture@8 uses `identityNotes` verbatim as its OBJECT-SPECIFIC block.
//
// Server-side only (OPENAI_API_KEY never touches the browser). One cheap call. On any
// error the client falls back to the deterministic extractor — generation never blocks.

const IDENTITY_MODEL = process.env.OPENAI_IDENTITY_MODEL || "gpt-4.1-mini";

type Body = { imageDataUrl?: string; extraImages?: string[]; subject?: string; preserveDetails?: boolean };

const SYSTEM = [
  "You are a product-identity analyst for a 3D asset studio.",
  "You are shown a real object (first image = the isolated object; a second image, if present, is its original photo with more detail).",
  "Describe ONLY the object's visual identity — the facts that must survive when it is re-sculpted as a stylised 3D collectible.",
  "Be concrete and specific about materials, exact colours (name them), decorative elements, and any text/logos (transcribe them exactly, in their own script).",
  "Do NOT describe the background, hands, lighting, or camera. Do NOT invent details you cannot see.",
  "Respond with STRICT JSON only.",
].join(" ");

function userPrompt(subject: string, preserveDetails: boolean): string {
  return [
    `The object is a ${subject || "home object"}.`,
    preserveDetails
      ? "Preserve details mode is ON: capture writing, logos, patterns and distinctive marks precisely."
      : "Simplify mode is ON: focus on shape, main materials and main colours; you may omit incidental text/logos.",
    "Return JSON with keys: shape (string), materials (string[]), colors (string[]), decorativeElements (string[]),",
    "text (string, exact transcription or empty), logos (string[]), proportions (string),",
    "and identityNotes (string): a tight markdown bullet list (one '- ' per line) combining the above into the",
    "object's essential identity, ordered most-distinctive first. identityNotes is what a 3D artist would read.",
  ].join(" ");
}

function parseDataUrl(dataUrl: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,.+/.test(dataUrl);
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.imageDataUrl || !parseDataUrl(body.imageDataUrl)) {
    return NextResponse.json({ error: "imageDataUrl (base64 image) is required" }, { status: 400 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set.", configured: false }, { status: 501 });

  const images = [body.imageDataUrl, ...(body.extraImages ?? [])].filter(parseDataUrl).slice(0, 2);
  const content = [
    { type: "text", text: userPrompt(body.subject ?? "", body.preserveDetails ?? true) },
    ...images.map((url) => ({ type: "image_url", image_url: { url, detail: "high" } })),
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: IDENTITY_MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 700,
      }),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      return NextResponse.json({ error: `OpenAI identity HTTP ${res.status}: ${text}` }, { status: 502 });
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
    const raw = json?.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "No identity returned" }, { status: 502 });
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Identity JSON parse failed" }, { status: 502 });
    }
    const identityNotes = typeof parsed.identityNotes === "string" ? parsed.identityNotes.trim() : "";
    if (!identityNotes) return NextResponse.json({ error: "Identity missing identityNotes" }, { status: 502 });
    return NextResponse.json({ identity: parsed, identityNotes, model: IDENTITY_MODEL });
  } catch (err) {
    return NextResponse.json({ error: `identity request failed: ${(err as Error).message}` }, { status: 502 });
  }
}
