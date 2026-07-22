"use client";

import { buildNestPrompt, scoreNestDna, NEST_EDITOR_ASPECT } from "@/lib/nest-factory/nest-dna";
import type { NestSpec } from "@/lib/nest-factory/translator";
import { publishFounderNest } from "@/lib/nest-factory/founder-publish-nest";
import { Field, Warn } from "@/components/generation/ui";
import type { GenerationModule } from "@/lib/generation-platform/types";

// Nest module — the empty-room engine plugged into the Generation Platform. Behaviour is
// byte-for-byte the pre-refactor Nest Factory; only the shared shell moved out. The ONLY
// engine difference from the Asset module is text-to-image (no cutout/segmentation).

export type NestResult = { imageDataUrl: string; costUsd: number | null };

type SavedNest = {
  id: string; name: string; spec: NestSpec; finalDataUrl: string;
  costUsd: number | null; dnaScore: number; createdAt: string;
  published?: boolean; imageUrl?: string;
};

const ASPECT_CSS = NEST_EDITOR_ASPECT.replace(":", " / ");

export const nestModule: GenerationModule<NestSpec, NestResult> = {
  key: "nest",
  uploadMode: "none",
  copy: {
    headerTitle: "Nest Factory",
    headerTagline: "Describe an empty room — Nestudio builds the stage.",
    gateTitle: "Nest Factory",
    gateSubtitle: "Founder access required. Enter your access code to create and publish Nests.",
    gateButton: "Enter Factory",
    inputPlaceholder: "e.g. A warm modern music studio with a large back wall, wooden floor and soft evening light.",
    inputHint: "Architecture only — walls, floor, ceiling, windows, light, mood. No furniture; creators decorate it later.",
    publishingLabel: "Publishing to your Nest Library…",
    approveLabel: "Approve & Publish",
    reviewQuestion: "Would I proudly let creators build inside this Nest?",
    detailsLabel: "(DNA checks · cost · camera)",
    backHref: "/create",
  },

  async translate({ description, headers }) {
    try {
      const res = await fetch("/api/ai/nest/translate", {
        method: "POST", headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ description }),
      });
      if (res.status === 401) return { ok: false, error: "", unauthorized: true };
      if (res.status === 403) return { ok: false, error: "This studio is for founders only.", forbidden: true };
      const j = await res.json();
      if (!res.ok || !j.spec) return { ok: false, error: j.error || "Could not interpret the room." };
      return { ok: true, value: j.spec as NestSpec };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  estimatedCost: (spec) => spec.estimatedCostUsd,
  moderationOk: (spec) => spec.moderation.ok,
  specName: (spec) => spec.name,

  async generate({ spec, setProgress, headers }) {
    setProgress("Building the empty Nest…");
    try {
      const { positive, negative } = buildNestPrompt(spec);
      const r = await fetch("/api/ai/nest/generate", {
        method: "POST", headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ positive, negative, id: `nest-${Date.now().toString(36)}` }),
      });
      if (r.status === 401) return { ok: false, error: "", unauthorized: true };
      if (r.status === 403) return { ok: false, error: "This studio is for founders only.", forbidden: true };
      const rj = await r.json();
      if (!r.ok || !rj.imageDataUrl) return { ok: false, error: rj.error || "Nest generation failed." };
      return { ok: true, value: { imageDataUrl: rj.imageDataUrl as string, costUsd: rj.costUsd ?? null } };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  resultImage: (r) => r.imageDataUrl,
  resultCost: (r) => r.costUsd,

  async publish({ spec, result }) {
    return publishFounderNest({ spec, finalDataUrl: result.imageDataUrl });
  },

  onApproved({ spec, result, outcome }) {
    const nest: SavedNest = {
      id: outcome.ok ? outcome.id : `nest-${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-v1`,
      name: spec.name, spec, finalDataUrl: result.imageDataUrl,
      costUsd: result.costUsd, dnaScore: scoreNestDna(spec).score, createdAt: new Date().toISOString(),
      published: outcome.ok, imageUrl: outcome.ok ? outcome.imageUrl : undefined,
    };
    try {
      const key = "nestudio:founder-nest-library:v1";
      const lib = JSON.parse(localStorage.getItem(key) || "[]") as SavedNest[];
      localStorage.setItem(key, JSON.stringify([nest, ...lib.filter((n) => n.id !== nest.id)]));
    } catch { /* non-fatal */ }
  },

  SpecView({ spec, onChange }) {
    return (
      <>
        <input value={spec.name} onChange={(e) => onChange({ ...spec, name: e.target.value })}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-base font-bold" />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Field k="Category" v={spec.category} />
          <Field k="Mood" v={spec.mood} />
          <Field k="Style" v={spec.architecturalStyle} />
          <Field k="Walls" v={spec.walls} />
          <Field k="Floor" v={spec.floorMaterial} />
          <Field k="Windows" v={spec.windows} />
          <Field k="Lighting" v={`${spec.lighting} · ${spec.timeOfDay}`} />
          <Field k="Est. cost" v={`$${spec.estimatedCostUsd.toFixed(2)}`} />
        </div>
        {spec.recommendedAssetTags.length > 0 && <p className="text-[11px] text-neutral-500">suits: {spec.recommendedAssetTags.join(", ")}</p>}
        <Warn ok={spec.brandNeutral.ok} label="Brand-neutral" note={spec.brandNeutral.note || "generic — no brand"} />
        <Warn ok={spec.moderation.ok} label="Safety" note={spec.moderation.note || "passed"} />
        <label className="block text-[11px] font-semibold text-neutral-500">Room description (editable)
          <textarea value={spec.generationSubject} onChange={(e) => onChange({ ...spec, generationSubject: e.target.value })} rows={2}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-800" />
        </label>
      </>
    );
  },

  ReviewView({ spec, result }) {
    const dna = scoreNestDna(spec);
    return (
      <>
        <div className="w-full overflow-hidden rounded-2xl border border-neutral-200" style={{ aspectRatio: ASPECT_CSS }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={result.imageDataUrl} alt={spec.name} className="h-full w-full object-cover" />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold">{spec.name}</span>
          <span className="text-neutral-500">${(result.costUsd ?? 0).toFixed(3)} · DNA {(dna.score * 100).toFixed(0)}%</span>
        </div>
      </>
    );
  },

  DetailsView({ spec, result }) {
    const dna = scoreNestDna(spec);
    return (
      <div className="space-y-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 text-[11px]">
        <div className="grid grid-cols-2 gap-1">
          {dna.checks.map((c) => <p key={c.label}>{c.ok ? "✓" : "⚠"} {c.label}</p>)}
        </div>
        <p>est ${spec.estimatedCostUsd.toFixed(2)} · actual ${(result.costUsd ?? 0).toFixed(3)} · camera {spec.compatibilityVersion} · raw = final (no post)</p>
      </div>
    );
  },

  SavedView({ info }) {
    return (
      <>
        <div className="mx-auto w-2/3 overflow-hidden rounded-2xl border border-neutral-200" style={{ aspectRatio: ASPECT_CSS }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={info.imageDataUrl} alt={info.name} className="h-full w-full object-cover" />
        </div>
        <p className="text-lg font-black">✓ {info.name} published</p>
        <p className="text-xs text-neutral-500">Live in your Nest Library · id <span className="font-mono">{info.id}</span></p>
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700">Open Create → Build My Own — it&apos;s selectable now as an empty Nest, ready to decorate. Survives reload.</p>
      </>
    );
  },
};
