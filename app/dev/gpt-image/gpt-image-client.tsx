"use client";

/**
 * GptImageClient — the M35 internal comparison bench.
 *
 * Runs the HONEST GPT-Image path (furniture@8, ONE call, no conform / no repair /
 * no regeneration) on the two mug tests and lays every stage side by side with
 * truthful metadata: model · latency · cost · promptVersion · Preserve/Simplify ·
 * retries · output dimensions · true-alpha status. Failed outputs are shown, never
 * hidden. Segmentation is the real on-device tap-to-select (clean cutout, no hand).
 *
 * NOT a user surface. The human judges — nothing is auto-scored or auto-selected.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RasterImage } from "@/lib/ai/types";
import { toRaster } from "@/lib/ai/canvas";
import { displayToSource } from "@/lib/cutout";
import {
  getSegmenter,
  maskToCutout,
  maskToFrame,
  sourceToCanvas,
  type Segmenter,
  type SegMask,
} from "@/lib/segmentation";
import { generateAssetHonest, type HonestResult, type PreserveMode } from "@/lib/asset-pipeline";

const SOFA = "/nests/library-v1/assets/ast-lr-sofa-boucle.webp";
const TABLE = "/nests/library-v1/assets/ast-lr-table-oak-round.webp";

// Transparency checker backdrop (inline — avoids Tailwind arbitrary-value parsing).
const CHECKER: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#17171a 25%,transparent 0),linear-gradient(-45deg,#17171a 25%,transparent 0),linear-gradient(45deg,transparent 75%,#17171a 0),linear-gradient(-45deg,transparent 75%,#17171a 0)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
  backgroundColor: "#0b0b0d",
};

type SlotDef = {
  key: string;
  label: string;
  src: string | null; // preset photo, or null for the upload slot
  subject: string;
  identityNotes: string;
  criteria: string[];
};

const SLOTS: SlotDef[] = [
  {
    key: "mug-a",
    label: "Mug A — cream + black B-handle",
    src: "/test-photos/mug-a.jpg",
    subject: "coffee mug",
    identityNotes: [
      "- cream ceramic mug",
      "- large black B-shaped handle on the left",
      "- black hand-painted word across the front",
      "- rounded body, wider than tall",
      "- open top with a visible dark inner cavity",
    ].join("\n"),
    criteria: [
      "B handle remains black",
      "handle remains recognisably B-shaped",
      "cream body remains cream",
      "writing present (Preserve mode)",
      "solid believable volume",
      "no melting / duplicate letters / broken rim",
      "no hand or curtain remains",
      "looks designed, not pasted",
    ],
  },
  {
    key: "mug-b",
    label: "Mug B — face, red cheeks, Persian text",
    src: "/test-photos/mug-b.jpeg",
    subject: "coffee mug",
    identityNotes: [
      "- white ceramic mug",
      "- a friendly face on the front: two eyes with red/pink cheeks",
      "- hand-painted Persian writing on the mug",
      "- rounded body with a single handle",
      "- open top with a visible inner cavity",
    ].join("\n"),
    criteria: [
      "eyes keep their arrangement and personality",
      "red cheek details survive",
      "Persian writing present (Preserve mode)",
      "handle & opening structurally correct",
      "no duplicated face elements",
      "no melted or missing mug wall",
      "reads as a premium 3D object",
    ],
  },
  {
    key: "upload",
    label: "Upload your own",
    src: null,
    subject: "object",
    identityNotes: "",
    criteria: [],
  },
];

export function GptImageClient() {
  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-black tracking-tight">GPT Image — honest bench</h1>
          <p className="mt-1 text-sm text-neutral-400">
            furniture@8 · one call · no conform, no repair, no regeneration ·{" "}
            <span className="text-neutral-300">OpenAI errors shown in full</span>. The human judges.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-1">
          {SLOTS.map((s) => (
            <SlotCard key={s.key} def={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SlotCard({ def }: { def: SlotDef }) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(def.src);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [original, setOriginal] = useState<RasterImage | null>(null);
  const [frame, setFrame] = useState<RasterImage | null>(null);
  const [cutout, setCutout] = useState<RasterImage | null>(null);
  const [mode, setMode] = useState<PreserveMode>("preserve");
  const [notes, setNotes] = useState(def.identityNotes);
  const [subject, setSubject] = useState(def.subject);
  const [preparing, setPreparing] = useState(false);
  const [tapping, setTapping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HonestResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const segRef = useRef<Segmenter | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyMask = useCallback(async (c: HTMLCanvasElement, mask: SegMask) => {
    const [fr, cut] = await Promise.all([maskToFrame(c, mask), maskToCutout(c, mask)]);
    setFrame(fr);
    setCutout(cut);
  }, []);

  // Load the source + auto-segment the largest object.
  useEffect(() => {
    if (!sourceUrl) return;
    let alive = true;
    setPreparing(true);
    setResult(null);
    setFrame(null);
    setCutout(null);
    (async () => {
      const c = await sourceToCanvas(sourceUrl);
      if (!alive) return;
      setCanvas(c);
      setOriginal(toRaster(c));
      const seg = await getSegmenter();
      if (!alive) return;
      segRef.current = seg;
      let mask: SegMask | null = null;
      try {
        const objs = await seg.detect(c);
        mask = objs[0]?.mask ?? null;
      } catch {
        /* fall through */
      }
      if (!mask) {
        try {
          mask = await seg.segmentAtPoint(c, { x: 0.5, y: 0.5 });
        } catch {
          /* none */
        }
      }
      if (mask && alive) await applyMask(c, mask);
      if (alive) setPreparing(false);
    })();
    return () => {
      alive = false;
    };
  }, [sourceUrl, applyMask]);

  const onTapStage = async (e: React.PointerEvent) => {
    if (!canvas || !segRef.current || tapping) return;
    const stage = stageRef.current!;
    const rect = stage.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * stage.clientWidth;
    const py = ((e.clientY - rect.top) / rect.height) * stage.clientHeight;
    const srcPt = displayToSource(
      { x: px, y: py },
      { width: stage.clientWidth, height: stage.clientHeight },
      { width: canvas.width, height: canvas.height },
    );
    const p = { x: srcPt.x / canvas.width, y: srcPt.y / canvas.height };
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
    setTapping(true);
    try {
      const mask = await segRef.current.segmentAtPoint(canvas, p);
      await applyMask(canvas, mask);
    } catch {
      /* keep previous */
    }
    setTapping(false);
  };

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSourceUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onGenerate = async () => {
    if (!cutout) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await generateAssetHonest({
        cutout,
        original: original ?? undefined,
        mask: frame ?? undefined,
        subject: subject.trim() || "object",
        mode,
        identityNotes: notes.trim() || undefined,
      });
      setResult(res);
    } catch (e) {
      // generateAssetHonest returns errors in-band; this is a last-resort guard.
      setResult({
        ok: false,
        provider: "openai",
        model: null,
        promptVersion: "furniture@8",
        mode,
        usedFallback: false,
        latencyMs: 0,
        costUsd: null,
        retryCount: 0,
        raw: null,
        finished: null,
        sent: { cutout },
        prompt: "",
        negative: "",
        hasAlpha: false,
        dimensions: {},
        error: (e as Error).message,
      });
    }
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">{def.label}</h2>
        <div className="flex items-center gap-2">
          <ModeToggle mode={mode} onChange={setMode} />
          {def.src === null ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800"
            >
              Choose photo
            </button>
          ) : null}
          <button
            type="button"
            onClick={onGenerate}
            disabled={!cutout || busy}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-black text-emerald-950 disabled:opacity-40"
          >
            {busy ? "Generating…" : "Generate (1 call)"}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-40 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100"
          />
        </label>
        <label className="flex flex-1 items-start gap-2 text-xs text-neutral-400">
          Object identity (real facts, not style)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="min-w-[220px] flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-[11px] text-neutral-100"
          />
        </label>
      </div>

      {/* Stage 1–5 panels */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Panel title="1 · Original">
          {sourceUrl ? <Img src={sourceUrl} /> : <Empty>—</Empty>}
        </Panel>

        <Panel title="2 · Cutout (tap to reselect)">
          <div
            ref={stageRef}
            onPointerDown={onTapStage}
            style={CHECKER}
            className="relative aspect-square w-full cursor-pointer select-none overflow-hidden rounded-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {original ? <img src={original.dataUrl} alt="" className="absolute inset-0 h-full w-full object-contain opacity-25" /> : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {frame ? <img src={frame.dataUrl} alt="cutout" className="absolute inset-0 h-full w-full object-contain" /> : null}
            {(preparing || tapping) ? <div className="absolute inset-0 animate-pulse bg-emerald-400/10" /> : null}
          </div>
        </Panel>

        <Panel title="3 · Sent to OpenAI">
          {cutout ? (
            <div className="relative">
              <Img src={cutout.dataUrl} checker />
              <div className="mt-1 flex gap-1">
                {original ? <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] text-neutral-300">+ original</span> : null}
                {frame ? <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] text-neutral-300">+ mask</span> : null}
              </div>
            </div>
          ) : (
            <Empty>tap the object</Empty>
          )}
        </Panel>

        <Panel title="4 · Raw OpenAI output">
          {result?.raw ? <Img src={result.raw.dataUrl} checker /> : <Empty>{busy ? "…" : "—"}</Empty>}
        </Panel>

        <Panel title="5 · Final asset">
          {result?.finished ? <Img src={result.finished.dataUrl} checker /> : <Empty>{busy ? "…" : "—"}</Empty>}
        </Panel>

        <Panel title="6 · In the Nest">
          {result?.finished ? <InNest asset={result.finished.dataUrl} /> : <Empty>—</Empty>}
        </Panel>
      </div>

      {/* Error (never hidden) */}
      {result && !result.ok ? (
        <div className="mt-3 rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-xs">
          <p className="font-bold text-rose-300">OpenAI generation failed</p>
          <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-rose-200">{result.error}</pre>
        </div>
      ) : null}

      {/* Truthful metadata */}
      {result ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-300">
          <Meta k="model" v={result.model ?? "—"} />
          <Meta k="latency" v={`${result.latencyMs} ms`} />
          <Meta k="cost" v={result.costUsd != null ? `$${result.costUsd.toFixed(4)}` : "n/a"} />
          <Meta k="prompt" v={result.promptVersion} />
          <Meta k="mode" v={result.mode} />
          <Meta k="retries" v={String(result.retryCount)} />
          <Meta
            k="raw dims"
            v={result.dimensions.raw ? `${result.dimensions.raw.w}×${result.dimensions.raw.h}` : "—"}
          />
          <Meta k="true alpha" v={result.hasAlpha ? "yes (native)" : "no"} />
          <Meta k="fallback" v={result.usedFallback ? "YES" : "no"} />
        </div>
      ) : null}

      {/* Pass criteria (human ticks these — not auto-scored) */}
      {def.criteria.length ? (
        <details className="mt-3 text-xs text-neutral-400">
          <summary className="cursor-pointer font-semibold text-neutral-300">Pass criteria (judge by eye)</summary>
          <ul className="mt-1 list-disc pl-5">
            {def.criteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Exact prompt sent */}
      {result?.prompt ? (
        <details className="mt-2 text-xs" open={showPrompt} onToggle={(e) => setShowPrompt((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer font-semibold text-neutral-300">Exact prompt sent</summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-neutral-950 p-2 font-mono text-[10px] text-neutral-300">
{result.prompt}
{"\n\nAvoid: "}{result.negative}
          </pre>
        </details>
      ) : null}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ""; }} />
    </section>
  );
}

/* ── small UI pieces ──────────────────────────────────────────────────────────── */

function ModeToggle({ mode, onChange }: { mode: PreserveMode; onChange: (m: PreserveMode) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-neutral-700 text-xs">
      {(["preserve", "simplify"] as PreserveMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 font-semibold capitalize ${mode === m ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:bg-neutral-800"}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">{title}</p>
      {children}
    </div>
  );
}

function Img({ src, checker }: { src: string; checker?: boolean }) {
  return (
    <div
      style={checker ? CHECKER : undefined}
      className={`aspect-square w-full overflow-hidden rounded-lg ${checker ? "" : "bg-neutral-950"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-contain" />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-neutral-800 text-[11px] text-neutral-600">
      {children}
    </div>
  );
}

function InNest({ asset }: { asset: string }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-b from-[#f3ead9] to-[#e6d4b8]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SOFA} alt="" className="absolute bottom-[8%] left-[2%] w-[58%] object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={TABLE} alt="" className="absolute bottom-[6%] right-[3%] w-[42%] object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset} alt="new asset" className="absolute bottom-[26%] right-[12%] w-[24%] object-contain drop-shadow-[0_8px_10px_rgba(56,41,29,0.35)]" />
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <span>
      <span className="text-neutral-500">{k}:</span> <span className="font-mono text-neutral-200">{v}</span>
    </span>
  );
}
