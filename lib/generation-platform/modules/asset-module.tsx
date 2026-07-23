"use client";

import type { RasterImage } from "@/lib/ai/types";
import { toRaster } from "@/lib/ai/canvas";
import { getSegmenter, maskToCutout, sourceToCanvas, type SegMask } from "@/lib/segmentation";
import { generateAssetHonest, type HonestResult } from "@/lib/asset-pipeline";
import type { MaterialFamily, ObjectMaterial } from "@/lib/asset-pipeline/materials";
import type { NestudioSpec } from "@/lib/asset-pipeline/translator";
import { publishFounderAsset } from "@/lib/nest/founder-publish";
import { CHECKER, Field, Thumb, Warn } from "@/components/generation/ui";
import type { GenerationModule } from "@/lib/generation-platform/types";

// Asset module — the object generation engine plugged into the Generation Platform.
// Behaviour is byte-for-byte the pre-refactor Asset Factory; only the shared shell moved out.

export type AssetResult = { honest: HonestResult; referenceUrl: string | null };

type SavedAsset = {
  id: string; name: string; spec: NestudioSpec; finalDataUrl: string;
  scope: "global" | "private-user"; ownerId: string | null;
  costUsd: number | null; pose?: HonestResult["pose"]; version: number; createdAt: string;
  published?: boolean; imageUrl?: string;
};

function materialFromSpec(spec: NestudioSpec): ObjectMaterial {
  const [primary, ...rest] = spec.materials;
  return { primary: (primary ?? "polymer") as MaterialFamily, accents: rest.map((f) => ({ family: f as MaterialFamily, part: "detail" })) };
}

export const assetModule: GenerationModule<NestudioSpec, AssetResult> = {
  key: "asset",
  uploadMode: "optional",
  copy: {
    headerTitle: "Asset Factory",
    headerTagline: "Describe it — Nestudio makes it belong.",
    gateTitle: "Creation Studio",
    gateSubtitle: "Founder access required. Enter your access code to create and publish.",
    gateButton: "Enter Studio",
    inputPlaceholder: "e.g. A warm acoustic guitar with a medium-brown wooden body and a simple modern shape.",
    publishingLabel: "Publishing to your Nestudio library…",
    approveLabel: "Approve & Add",
    reviewQuestion: "Would I proudly place this in a Nest?",
    detailsLabel: "(reference · raw · thumbnail · classification)",
    backHref: "/nest-editor",
  },

  async translate({ description, hasReference, headers }) {
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST", headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ description, hasReference }),
      });
      if (res.status === 401) return { ok: false, error: "", unauthorized: true };
      if (res.status === 403) return { ok: false, error: "This studio is for founders only.", forbidden: true };
      const j = await res.json();
      if (!res.ok || !j.spec) return { ok: false, error: j.error || "Could not interpret the request." };
      return { ok: true, value: j.spec as NestudioSpec };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  estimatedCost: (spec) => spec.estimatedCostUsd,
  moderationOk: (spec) => spec.moderation.ok,
  specName: (spec) => spec.name,

  async generate({ spec, upload, setProgress, headers }) {
    // No stage may hang forever — each bounded step has a timeout with a recoverable message.
    const withTimeout = <T,>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
      Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
    try {
      let sourceDataUrl = upload;
      let referenceUrl: string | null = upload;
      if (!sourceDataUrl) {
        setProgress("Creating a studio reference…");
        const r = await fetch("/api/ai/reference", {
          method: "POST", headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({ subject: spec.generationSubject, id: `factory-${Date.now().toString(36)}` }),
        });
        if (r.status === 401) return { ok: false, error: "", unauthorized: true };
        if (r.status === 403) return { ok: false, error: "This studio is for founders only.", forbidden: true };
        const rj = await r.json();
        if (!r.ok || !rj.imageDataUrl) return { ok: false, error: rj.error || "Reference generation failed." };
        sourceDataUrl = rj.imageDataUrl as string;
        referenceUrl = sourceDataUrl;
      }
      // Segmentation is on-device (MediaPipe WASM) and can stall on mobile — the Part-1 root
      // cause. It is now BEST-EFFORT and NON-BLOCKING: bounded by short timeouts, and on ANY
      // load/inference failure we proceed with the full image (GPT Image isolates on a
      // transparent background natively). The workflow therefore never dead-ends on segmentation.
      setProgress("Analysing your object…");
      const canvas = await sourceToCanvas(sourceDataUrl);
      const original = toRaster(canvas);
      let mask: SegMask | null = null;
      try {
        const seg = await withTimeout(getSegmenter(), 20_000, "seg-load");
        try { mask = (await withTimeout(seg.detect(canvas), 15_000, "seg-detect"))[0]?.mask ?? null; } catch { /* fall through */ }
        if (!mask) { try { mask = await withTimeout(seg.segmentAtPoint(canvas, { x: 0.5, y: 0.5 }), 15_000, "seg-point"); } catch { /* fall through */ } }
      } catch { /* segmenter failed to load in time — fall back to the full image below */ }
      setProgress("Preparing the object…");
      // Clean cutout when segmentation succeeded; otherwise the full image (server isolates it).
      const cutout: RasterImage = mask ? await maskToCutout(canvas, mask) : original;

      setProgress("Generating the Nestudio asset…");
      const honest = await withTimeout(
        generateAssetHonest({
          cutout, original, subject: spec.generationSubject,
          mode: upload ? "preserve" : "simplify", material: materialFromSpec(spec),
          authHeaders: headers,
        }),
        150_000,
        "Generation is taking longer than expected. No charge was completed — please try again.",
      );
      if (!honest.ok) return { ok: false, error: honest.error || "Generation failed." };
      setProgress("Cleaning transparency…");
      return { ok: true, value: { honest, referenceUrl } };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  },

  resultImage: (r) => r.honest.finished!.dataUrl,
  resultCost: (r) => r.honest.costUsd,

  async publish({ spec, result }) {
    return publishFounderAsset({ spec, finalDataUrl: result.honest.finished!.dataUrl });
  },

  onApproved({ spec, result, outcome }) {
    const asset: SavedAsset = {
      id: outcome.ok ? outcome.id : `ast-${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-v1`,
      name: spec.name, spec, finalDataUrl: result.honest.finished!.dataUrl,
      scope: "global", ownerId: null,
      costUsd: result.honest.costUsd, pose: result.honest.pose, version: 1, createdAt: new Date().toISOString(),
      published: outcome.ok, imageUrl: outcome.ok ? outcome.imageUrl : undefined,
    };
    try {
      const key = "nestudio:founder-library:v1";
      const lib = JSON.parse(localStorage.getItem(key) || "[]") as SavedAsset[];
      localStorage.setItem(key, JSON.stringify([asset, ...lib.filter((a) => a.id !== asset.id)]));
    } catch { /* non-fatal */ }
  },

  SpecView({ spec, onChange }) {
    return (
      <>
        <input value={spec.name} onChange={(e) => onChange({ ...spec, name: e.target.value })}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-base font-bold" />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Field k="Class" v={spec.objectClass} />
          <Field k="Role" v={spec.visualRole} />
          <Field k="Materials" v={spec.materials.join(" · ")} />
          <Field k="Interaction" v={spec.interaction} />
          <Field k="Pose" v={spec.canonicalPose} />
          <Field k="Placement" v={spec.placement} />
          <Field k="Surface" v={spec.surface} />
          <Field k="Est. cost" v={`$${spec.estimatedCostUsd.toFixed(2)}`} />
        </div>
        {spec.tags.length > 0 && <p className="text-[11px] text-neutral-500">tags: {spec.tags.join(", ")}</p>}
        <Warn ok={spec.brandNeutral.ok} label="Brand-neutral" note={spec.brandNeutral.note || "generic — no brand"} />
        <Warn ok={spec.moderation.ok} label="Safety" note={spec.moderation.note || "passed"} />
        <label className="block text-[11px] font-semibold text-neutral-500">Generation subject (editable)
          <input value={spec.generationSubject} onChange={(e) => onChange({ ...spec, generationSubject: e.target.value })}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-800" />
        </label>
      </>
    );
  },

  ReviewView({ spec, result }) {
    return (
      <>
        <div style={CHECKER} className="aspect-square w-full overflow-hidden rounded-2xl border border-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={result.honest.finished!.dataUrl} alt={spec.name} className="h-full w-full object-contain" />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold">{spec.name}</span>
          <span className="text-neutral-500">${(result.honest.costUsd ?? 0).toFixed(3)} · {result.honest.pose?.inTolerance ? "pose ✓" : "pose ⚠"}</span>
        </div>
        {!spec.brandNeutral.ok && <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700">Brand-neutrality: {spec.brandNeutral.note}</div>}
      </>
    );
  },

  DetailsView({ spec, result }) {
    return (
      <div className="space-y-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 text-[11px]">
        <div className="grid grid-cols-3 gap-2">
          <Thumb label="Studio ref" src={result.referenceUrl} />
          <Thumb label="Raw" src={result.honest.raw?.dataUrl ?? null} checker />
          <Thumb label="Editor size" src={result.honest.finished!.dataUrl} checker small />
        </div>
        <p>material: <b>{spec.materials.join(", ")}</b> · pose symmetry: <b>{result.honest.pose?.symmetry?.toFixed(3) ?? "—"}</b> ({result.honest.pose?.inTolerance ? "canonical" : "off-pose"})</p>
        <p>est ${spec.estimatedCostUsd.toFixed(2)} · actual ${(result.honest.costUsd ?? 0).toFixed(3)} · model {result.honest.model}</p>
      </div>
    );
  },

  SavedView({ info }) {
    return (
      <>
        <div style={CHECKER} className="mx-auto aspect-square w-2/3 overflow-hidden rounded-2xl border border-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={info.imageDataUrl} alt={info.name} className="h-full w-full object-contain" />
        </div>
        <p className="text-lg font-black">✓ {info.name} published</p>
        <p className="text-xs text-neutral-500">Live in the Nestudio library · scope <b>global</b> · id <span className="font-mono">{info.id}</span></p>
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700">Saved to Supabase (Storage + catalog). Open the editor and it&apos;s in your Assets tray — it survives reload.</p>
      </>
    );
  },
};
