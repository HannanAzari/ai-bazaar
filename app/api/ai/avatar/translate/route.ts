import { NextResponse } from "next/server";
import { requireUser } from "@/lib/user-gate";
import {
  AVATAR_CAMERA_DNA_VERSION,
  buildAvatarTranslatorSystemPrompt,
  estimateAvatarCost,
  type AvatarSpec,
  type StyleIntensity,
} from "@/lib/avatar-factory/translator";

// Avatar Translator route — vision read of the user's photo → privacy-safe AvatarSpec.
// Authenticated as the real USER (not the founder token). The photo is processed in
// memory only; nothing is stored here.

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.OPENAI_IDENTITY_MODEL || "gpt-4.1-mini";

type Body = { imageDataUrl?: string };

const STYLES = new Set<string>(["subtle", "balanced", "stylised"]);

function parseDataUrl(dataUrl: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,.+$/.test(dataUrl);
}

export async function POST(request: Request) {
  const gate = await requireUser();
  if ("response" in gate) return gate.response;

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

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: buildAvatarTranslatorSystemPrompt() },
          { role: "user", content: [
            { type: "text", text: "Describe ONLY the neutral, visible appearance needed to redraw this person as a Nestudio avatar. Obey the privacy law." },
            { type: "image_url", image_url: { url: body.imageDataUrl } },
          ] },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 600,
      }),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      return NextResponse.json({ error: `OpenAI avatar translate HTTP ${res.status}: ${text}` }, { status: 502 });
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json?.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "No spec returned" }, { status: 502 });

    let p: Record<string, unknown>;
    try { p = JSON.parse(raw) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Spec JSON parse failed" }, { status: 502 }); }

    // Normalise ANY shape (string | array | object) into readable text — the model sometimes
    // returns e.g. hair as { color, length, style }, which naive String() renders "[object Object]".
    const norm = (v: unknown, fallback: string): string => {
      if (typeof v === "string") return v.trim() || fallback;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      if (Array.isArray(v)) return v.map((x) => norm(x, "")).filter(Boolean).join(", ") || fallback;
      if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).map((x) => norm(x, "")).filter(Boolean).join(" ") || fallback;
      return fallback;
    };
    const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => norm(x, "")).filter(Boolean).slice(0, 6) : []);
    const moderation = (p.moderation && typeof p.moderation === "object" ? p.moderation : { ok: true, note: "" }) as AvatarSpec["moderation"];

    const spec: AvatarSpec = {
      displayName: norm(p.displayName, "My Avatar").slice(0, 40),
      styleIntensity: (STYLES.has(String(p.styleIntensity)) ? p.styleIntensity : "balanced") as StyleIntensity,
      outfitCategory: norm(p.outfitCategory, "casual").slice(0, 40),
      clothingPalette: norm(p.clothingPalette, "warm neutrals").slice(0, 60),
      hair: norm(p.hair, "short hair").slice(0, 80),
      accessories: strArr(p.accessories),
      expression: norm(p.expression, "neutral").slice(0, 40),
      bodyProportionFamily: norm(p.bodyProportionFamily, "standard").slice(0, 30),
      canonicalPose: "idle-standing",
      transparency: true,
      intendedUses: ["profile", "editor"],
      privacyScope: "private-user",
      estimatedCostUsd: estimateAvatarCost(),
      moderation: { ok: moderation.ok !== false, note: norm(moderation.note, "") },
      generationSubject: norm(p.generationSubject, "a person standing with arms relaxed").slice(0, 200),
    };

    return NextResponse.json({ spec, model: MODEL, cameraDnaVersion: AVATAR_CAMERA_DNA_VERSION });
  } catch (err) {
    return NextResponse.json({ error: `avatar translate failed: ${(err as Error).message}` }, { status: 502 });
  }
}
