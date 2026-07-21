import { NextResponse } from "next/server";

// Identity extraction. BEFORE GPT Image runs, a vision model reads the selected object
// and returns its OBJECTIVE identity — what makes THIS object recognisable: what it is,
// colours, distinct physical parts + identifying shapes, exact text/logos, decorative
// motifs (as subject facts), and the physical-part-vs-typography disambiguation (so a
// B-shaped handle is a handle, not a duplicated letter). furniture@8 uses `identityNotes`
// verbatim as its OBJECT-SPECIFIC block.
//
// The identity extractor states FACTS ONLY. It must never describe style, finish,
// geometry, silhouette, lighting or rendering — furniture@8 alone owns style / Nestudio
// DNA. (Describing style here previously fought furniture@8's matte look — a regression.)
//
// Server-side only (OPENAI_API_KEY never touches the browser). One cheap call. On any
// error the client falls back to the deterministic extractor — generation never blocks.

const IDENTITY_MODEL = process.env.OPENAI_IDENTITY_MODEL || "gpt-4.1-mini";

type Body = { imageDataUrl?: string; extraImages?: string[]; subject?: string; preserveDetails?: boolean };

const SYSTEM = [
  "You are an object-identity analyst for a 3D asset studio. Your ONLY job is to state the OBJECTIVE facts that make THIS specific object recognisable — what would let someone pick it out of a lineup of otherwise-similar objects.",
  "You are shown a real object (first image = the isolated object; a second image, if present, is its original photo with more detail).",
  "You are NOT an art director. You NEVER describe style, quality, or how to render the object — style is decided entirely elsewhere and your words must not influence it.",
  // hard exclusions — the identity extractor must never touch style / DNA.
  "NEVER mention: material finish or quality (matte, glossy, satin, polished, smooth, shiny, premium, high-quality, sleek, refined), geometry or silhouette style (rounded, soft, sculpted, inflated, elegant, organic, clean lines), lighting, shadow, shading, reflections, rendering, mood, or any artistic interpretation. Never call the object beautiful, cute, premium, handcrafted or well-made.",
  // what to extract — objective facts only.
  "State ONLY objective facts: what the object is; its colours (named); its distinct PHYSICAL PARTS and the plain shape that identifies each (a handle shaped like the letter B, a spout, two ear-shaped bumps, three feet); any TEXT/lettering/logos transcribed EXACTLY in their own script; its DECORATION as plain subject facts (what a pattern or picture depicts, the motif, and any regional/cultural style NAME such as Persian floral, paisley or mosaic); and its material only as a plain noun when the material itself identifies the object (ceramic, copper, brass, glass, wood) — never with an adjective.",
  // P1 (kept — this is objective) — a physical part is not text.
  "CRITICAL: a PHYSICAL PART is solid 3D structure, never printed text — even when its shape resembles a letter, number or symbol. Classify a letter-shaped part (e.g. a B-shaped handle) as a PHYSICAL PART, and add an explicit note that it must not be duplicated as printed text or an extra character. Never confuse a physical part with text.",
  "Do NOT describe the background, hands, camera or scene. Do NOT invent facts you cannot actually see.",
  "Respond with STRICT JSON only.",
].join(" ");

function userPrompt(subject: string, preserveDetails: boolean): string {
  return [
    `The object is a ${subject || "home object"}.`,
    preserveDetails
      ? "Preserve details: capture every distinctive part, colour, exact text, logo and decorative motif that identifies this exact object."
      : "Simplify: capture the object type, main colours, main parts and identifying shapes only; you may omit incidental text/logos.",
    "Return JSON with keys (OBJECTIVE FACTS ONLY — no style, finish, geometry, lighting or rendering words anywhere):",
    "whatItIs (string — plain identification), ",
    "colors (string[] — named colours), ",
    "material (string[] — plain material nouns only, no adjectives, only when the material identifies the object; else empty), ",
    "physicalParts (string[] — each distinct 3D part + the plain shape that identifies it; flag any letter-shaped part as a physical part, not text), ",
    "typography (string — printed/painted TEXT only, exact transcription in original script, or empty), logos (string[]), ",
    "decorativeElements (string[] — what each pattern/picture depicts + its motif + any cultural style NAME, as plain facts — never how it is rendered), ",
    "disambiguation (string[] — DO-NOT-DUPLICATE / part-is-not-text / no-extra-parts notes), ",
    "distinctiveFeatures (string[] — the 2-4 facts that most uniquely identify this object), ",
    "and identityNotes (string): a markdown bullet list of OBJECTIVE identity facts ONLY (no finish/geometry/lighting/style words), with clearly labelled PHYSICAL PARTS, TEXT, DECORATION and DO-NOT-DUPLICATE lines where relevant. Each bullet a concrete fact a copyist needs.",
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
        max_tokens: 1200,
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
