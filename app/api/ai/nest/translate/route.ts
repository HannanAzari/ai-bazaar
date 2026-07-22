import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/founder-role";
import {
  buildNestTranslatorSystemPrompt,
  estimateNestCost,
  NEST_CAMERA_DNA_VERSION,
  NEST_WALL_CONFIGS,
  type NestSpec,
  type NestWallConfig,
} from "@/lib/nest-factory/translator";

// The Nest Translator — intent → structured Nest DNA spec. One cheap LLM call; the
// founder reviews/edits BEFORE spending on generation. Server-side + founder-gated.

export const runtime = "nodejs";
export const maxDuration = 60;

const TRANSLATE_MODEL = process.env.OPENAI_IDENTITY_MODEL || "gpt-4.1-mini";

type Body = { description?: string };

const WALLS = new Set<string>(NEST_WALL_CONFIGS);

export async function POST(request: Request) {
  const gate = await requireFounder(request);
  if ("response" in gate) return gate.response;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const description = (body.description ?? "").trim();
  if (!description) return NextResponse.json({ error: "description is required" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set.", configured: false }, { status: 501 });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: TRANSLATE_MODEL,
        messages: [
          { role: "system", content: buildNestTranslatorSystemPrompt() },
          { role: "user", content: `Room request: ${description}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 700,
      }),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      return NextResponse.json({ error: `OpenAI translate HTTP ${res.status}: ${text}` }, { status: 502 });
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json?.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "No spec returned" }, { status: 502 });

    let p: Record<string, unknown>;
    try {
      p = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Spec JSON parse failed" }, { status: 502 });
    }

    const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : []);
    const brandNeutral = (p.brandNeutral && typeof p.brandNeutral === "object" ? p.brandNeutral : { ok: true, note: "" }) as NestSpec["brandNeutral"];
    const moderation = (p.moderation && typeof p.moderation === "object" ? p.moderation : { ok: true, note: "" }) as NestSpec["moderation"];

    const spec: NestSpec = {
      name: String(p.name || "New Nest").slice(0, 60),
      category: String(p.category || "Minimal Apartment").slice(0, 60),
      mood: String(p.mood || "warm / calm").slice(0, 80),
      architecturalStyle: String(p.architecturalStyle || "warm minimal").slice(0, 80),
      walls: (WALLS.has(String(p.walls)) ? p.walls : "front-left-right") as NestWallConfig,
      floorMaterial: String(p.floorMaterial || "matte warm timber").slice(0, 80),
      ceiling: String(p.ceiling || "flat soft-white ceiling").slice(0, 80),
      windows: String(p.windows || "soft daylight from one side").slice(0, 120),
      palette: String(p.palette || "warm neutrals").slice(0, 100),
      lighting: String(p.lighting || "soft indirect key").slice(0, 100),
      timeOfDay: String(p.timeOfDay || "daytime").slice(0, 40),
      architecturalDetails: strArr(p.architecturalDetails),
      recommendedAssetTags: strArr(p.recommendedAssetTags),
      compatibilityVersion: NEST_CAMERA_DNA_VERSION,
      estimatedCostUsd: estimateNestCost(),
      brandNeutral: { ok: brandNeutral.ok !== false, note: String(brandNeutral.note || "") },
      moderation: { ok: moderation.ok !== false, note: String(moderation.note || "") },
      generationSubject: String(p.generationSubject || description).slice(0, 240),
    };

    return NextResponse.json({ spec, model: TRANSLATE_MODEL });
  } catch (err) {
    return NextResponse.json({ error: `nest translate request failed: ${(err as Error).message}` }, { status: 502 });
  }
}
