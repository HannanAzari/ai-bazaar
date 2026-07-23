import { NextResponse } from "next/server";
import { applyFamilyDefaults, buildTranslatorSystemPrompt, estimateCost, type NestudioSpec } from "@/lib/asset-pipeline/translator";
import { requireFounder } from "@/lib/founder-role";

export const runtime = "nodejs";
export const maxDuration = 60;

// The Nestudio Translator — intent → structured DNA spec. One cheap LLM call; the founder
// reviews (and may edit) the result BEFORE spending on generation. Server-side only.

const TRANSLATE_MODEL = process.env.OPENAI_IDENTITY_MODEL || "gpt-4.1-mini";

type Body = { description?: string; hasReference?: boolean };

const ALLOWED_MATERIALS = new Set([
  "timber", "matte-metal", "warm-metal", "polymer", "screen", "glass", "ceramic", "fabric", "leather", "paper", "rubber", "greenery",
]);
const CLASSES = new Set(["Story", "Identity", "Portal", "Memory"]);

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
          { role: "system", content: buildTranslatorSystemPrompt() },
          { role: "user", content: `Request: ${description}${body.hasReference ? "\n(The user also uploaded a reference image.)" : ""}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
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

    // Validate + coerce to the DNA vocabulary (never trust the model blindly).
    const materials = (Array.isArray(p.materials) ? (p.materials as string[]) : []).filter((m) => ALLOWED_MATERIALS.has(m));
    const objectClass = CLASSES.has(String(p.objectClass)) ? (p.objectClass as NestudioSpec["objectClass"]) : "Story";
    const brandNeutral = (p.brandNeutral && typeof p.brandNeutral === "object" ? p.brandNeutral : { ok: true, note: "" }) as NestudioSpec["brandNeutral"];
    const moderation = (p.moderation && typeof p.moderation === "object" ? p.moderation : { ok: true, note: "" }) as NestudioSpec["moderation"];

    const spec: NestudioSpec = {
      name: String(p.name || "New Object").slice(0, 60),
      objectClass,
      tags: (Array.isArray(p.tags) ? (p.tags as string[]) : []).map(String).slice(0, 8),
      materials: materials.length ? (materials as NestudioSpec["materials"]) : ["polymer"],
      canonicalPose: String(p.canonicalPose || "front-facing, slightly elevated"),
      visualRole: (["Hero", "Supporting", "Atmosphere", "Memory", "Background"].includes(String(p.visualRole)) ? p.visualRole : "Supporting") as NestudioSpec["visualRole"],
      interaction: (["SCREEN", "OPEN", "BOOK", "DRAWER", "DISPLAY", "PLAY", "EXAMINE", "TOGGLE", "static"].includes(String(p.interaction)) ? p.interaction : "static") as NestudioSpec["interaction"],
      surface: (["none", "link-grid", "gallery", "video", "feed", "player", "product", "story", "profile"].includes(String(p.surface)) ? p.surface : "none") as NestudioSpec["surface"],
      placement: (["floor", "surface", "wall", "floor-or-surface"].includes(String(p.placement)) ? p.placement : "floor") as NestudioSpec["placement"],
      estimatedCostUsd: estimateCost(!!body.hasReference),
      brandNeutral: { ok: brandNeutral.ok !== false, note: String(brandNeutral.note || "") },
      moderation: { ok: moderation.ok !== false, note: String(moderation.note || "") },
      generationSubject: String(p.generationSubject || description).slice(0, 200),
    };

    // Deterministic family defaults: a guitar can never come back Story/static.
    const { spec: finalSpec, matched } = applyFamilyDefaults(spec);
    return NextResponse.json({ spec: finalSpec, model: TRANSLATE_MODEL, familyMatched: matched });
  } catch (err) {
    return NextResponse.json({ error: `translate request failed: ${(err as Error).message}` }, { status: 502 });
  }
}
