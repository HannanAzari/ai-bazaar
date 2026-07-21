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
  "You are a master object-identity analyst for a 3D asset studio, with an eye for craft, materials and cultural design.",
  "You are shown a real object (first image = the isolated object; a second image, if present, is its original photo with more detail).",
  "Describe ONLY the object's visual identity — the specific facts that make THIS object itself and must survive when it is re-sculpted as a stylised 3D collectible.",
  // P1 — categorise, and never confuse a physical part with printed text.
  "CATEGORISE what you see into: (a) STRUCTURAL GEOMETRY — the overall body/silhouette; (b) PHYSICAL PARTS — separate 3D pieces you could physically touch (handles, spouts, lids, knobs, feet, ears, openings); (c) TYPOGRAPHY — printed or painted TEXT/letters; (d) LOGOS/SYMBOLS; (e) DECORATION — painted patterns, carvings, engravings, inlay, mosaic, embroidery, illustration.",
  "CRITICAL: a PHYSICAL PART is solid 3D structure, NEVER printed text — even when its SHAPE resembles a letter, number or symbol. If a handle, spout or part looks like a letter (e.g. a mug handle shaped like the letter 'B'), classify it as a PHYSICAL PART, and add an explicit disambiguation note that it must be rebuilt as ONE solid 3D part and must NOT also be drawn as printed text or duplicated as an extra character. Never let a physical part and printed text be merged, confused or duplicated.",
  // P2 — capture the ornate personality, never a simplified version.
  "Be MAXIMALLY specific and never generic about materials and decoration. Name the exact material and finish (glazed turquoise mosaic ceramic, hammered copper, brushed brass, lacquered wood, frosted glass, cloisonne enamel), and for every ornament give the motif, its layout, its colours and any historical/regional/cultural style (Persian floral geometry, Isfahan enamel, paisley, Art-Deco fluting). Capture the object's PERSONALITY — recreate it, do not simplify it.",
  "Transcribe any printed/painted text EXACTLY in its own script, and say how many times it appears (usually once).",
  "Do NOT describe the background, hands, lighting, camera or the scene. Do NOT invent details you cannot actually see.",
  "Respond with STRICT JSON only.",
].join(" ");

function userPrompt(subject: string, preserveDetails: boolean): string {
  return [
    `The object is a ${subject || "home object"}.`,
    preserveDetails
      ? "Preserve details mode is ON: capture every material, ornament, carving, engraving, pattern, mosaic, embroidery, painted illustration, logo and text precisely — recreate the personality, do not simplify."
      : "Simplify mode is ON: focus on the exact shape, main materials/finish and main colours; you may omit incidental text/logos.",
    "Return JSON with keys:",
    "structuralGeometry (string — the overall body/silhouette), ",
    "physicalParts (string[] — each separate 3D part with its shape; if a part's shape resembles a letter/number/symbol, say so AND state it is a physical part, not text), ",
    "materials (string[] — material + finish, most specific), colors (string[] — named), ",
    "decorativeElements (string[] — painted patterns, carvings, engravings, inlay, mosaic, embroidery, illustration: motif + layout + colours + cultural style), ",
    "typography (string — printed/painted TEXT ONLY, exact transcription in original script, or empty), logos (string[]), ",
    "disambiguation (string[] — explicit DO-NOT-DUPLICATE / DO-NOT-CONFUSE warnings, e.g. 'the B-shaped element is the physical handle, not a printed letter — render one handle and do not add an extra B'), ",
    "proportions (string), signatures (string[] — the 2-4 unique visual features that most identify this exact object), ",
    "and identityNotes (string): a markdown bullet list a 3D artist reads to rebuild THIS object, ordered most-distinctive first. It MUST include clearly labelled lines for PHYSICAL PARTS, TEXT (if any), DECORATION, and any DO-NOT-DUPLICATE disambiguation. Each bullet concrete and specific.",
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
