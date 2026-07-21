"use client";

/**
 * CreateAssetSheet — the editor-first asset factory.
 *
 * Flow: Source (Camera / Library) → LARGE original photo (Continue) → premium
 * SEGMENTATION ("tap the object you want", on-device model — Telegram / Apple
 * Photos feel) → Generate ONE → Result ("Use" / "Improve") → Success ✨ → back to
 * the editor, the new asset waiting in My Assets.
 *
 * Segmentation is REAL on-device segmentation (lib/segmentation: MediaPipe with a
 * local flood fallback), NOT an AI prompt and NOT Gemini. This sprint only replaces
 * the cutout experience — no generation/prompt/model/style changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Eraser, Brush, RotateCcw, Check, X, Sparkles, ArrowLeft, Wand2, Pencil, Hand } from "lucide-react";
import type { RasterImage } from "@/lib/ai/types";
import { clampBrush, pointsAlongStroke, displayToSource, compositeMask, CUTOUT_DEFAULTS } from "@/lib/cutout";
import { loadImage, makeCanvas, toRaster } from "@/lib/ai/canvas";
import {
  getSegmenter,
  maskToCutout,
  maskToFrame,
  maskBBox,
  sourceToCanvas,
  type Segmenter,
  type SegMask,
  type DetectedObject,
} from "@/lib/segmentation";
import { generateAssetHonest, inventoryAssetFromCandidate, type AssetCandidate } from "@/lib/asset-pipeline";
import { inventory } from "@/lib/ai-inventory";

type Step = "source" | "preview" | "segment" | "generating" | "result" | "refine" | "success";
type BrushMode = "erase" | "restore";

const STAGES = ["Studying your object", "Sketching", "Painting", "Matching the Nestudio style", "Finishing"];
const REFINE_EXAMPLES = ["make it rounder", "remove the text", "more wooden", "less cartoon", "brighter", "thicker handle"];

export function CreateAssetSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (assetId: string) => void;
}) {
  const [step, setStep] = useState<Step>("source");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [result, setResult] = useState<AssetCandidate | null>(null);
  const [refineText, setRefineText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("source");
    setSourceUrl(null);
    setSubject("");
    setResult(null);
    setRefineText("");
    setError(null);
    setFallbackNote(null);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setSourceUrl(dataUrl);
      setStep("preview");
    } catch (e) {
      setError(`Couldn't read that photo: ${(e as Error).message}`);
    }
  };

  const runGenerate = async (inputCutout: RasterImage, extra?: { original?: RasterImage; mask?: RasterImage; notes?: string }) => {
    setStep("generating");
    setError(null);
    setFallbackNote(null);
    try {
      // M35: the honest GPT-Image path — ONE genuine result, no silent fallback,
      // no conform/repair. OpenAI errors surface plainly.
      const res = await generateAssetHonest({
        cutout: inputCutout,
        subject: subject.trim() || "object",
        notes: extra?.notes,
        original: extra?.original,
        mask: extra?.mask,
        mode: "preserve",
      });
      if (!res.ok || !res.finished) {
        setError(res.error ?? "That didn't work — let's try once more.");
        setStep(extra?.notes ? "refine" : "segment");
        return;
      }
      setResult({ image: res.finished, provider: res.provider, dnaVersion: res.promptVersion });
      setStep("result");
    } catch (e) {
      setError((e as Error).message);
      setStep(extra?.notes ? "refine" : "segment");
    }
  };

  const onUse = async () => {
    if (!result) return;
    try {
      const asset = inventoryAssetFromCandidate(result, { subject: subject.trim() || "object" });
      await inventory.save(asset);
      setStep("success");
      window.setTimeout(() => {
        onCreated(asset.id);
        onClose();
      }, 1150);
    } catch (e) {
      setError(`Couldn't save: ${(e as Error).message}`);
    }
  };

  if (!open) return null;
  const canGoBack = step !== "source" && step !== "success";

  return (
    <div className="asset-modal fixed inset-0 z-[80] flex items-stretch justify-center sm:items-center">
      <div className="asset-backdrop absolute inset-0" onClick={step === "source" ? onClose : undefined} aria-hidden />

      <div className="asset-card relative z-10 flex w-full max-w-md flex-col overflow-hidden bg-parchment/85 shadow-[0_24px_70px_-18px_rgba(56,41,29,0.5)] sm:max-h-[94vh] sm:rounded-[32px]">
        <div className="flex items-center justify-between px-4 pb-1 pt-[max(0.9rem,env(safe-area-inset-top))]">
          <button type="button" onClick={step === "source" ? onClose : reset} aria-label={step === "source" ? "Close" : "Start over"} className="spring rounded-full p-2 text-ink/55 hover:bg-ink/5">
            {canGoBack ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </button>
          <p className="text-sm font-black tracking-tight text-ink">Create asset</p>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[max(1.2rem,env(safe-area-inset-bottom))]">
          {error ? <p className="mx-auto mb-3 max-w-sm rounded-2xl border border-rust/25 bg-rust/10 px-3 py-2 text-center text-xs font-semibold text-rust">{error}</p> : null}

          {step === "source" ? <SourceStep onCamera={() => cameraRef.current?.click()} onLibrary={() => libraryRef.current?.click()} /> : null}
          {step === "preview" && sourceUrl ? <PreviewStep src={sourceUrl} onContinue={() => setStep("segment")} onRetake={reset} /> : null}
          {step === "segment" && sourceUrl ? (
            <SegmentStep sourceUrl={sourceUrl} subject={subject} onSubjectChange={setSubject} onGenerate={runGenerate} />
          ) : null}
          {step === "generating" ? <GeneratingStep /> : null}
          {step === "result" && result ? <ResultStep result={result} note={fallbackNote} onUse={onUse} onImprove={() => setStep("refine")} /> : null}
          {step === "refine" && result ? <RefineStep value={refineText} onChange={setRefineText} onCancel={() => setStep("result")} onSubmit={() => runGenerate(result.image, { notes: refineText.trim() })} /> : null}
          {step === "success" ? <SuccessStep /> : null}
        </div>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onPickFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPickFile(e.target.files?.[0]); e.target.value = ""; }} />
      <StyleBlock />
    </div>
  );
}

/* ── Source + preview ────────────────────────────────────────────────────────── */

function SourceStep({ onCamera, onLibrary }: { onCamera: () => void; onLibrary: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 pt-6">
      <div className="pb-1 text-center">
        <p className="text-lg font-black tracking-tight text-ink">Photograph something you love</p>
        <p className="mt-1 text-sm text-ink/55">We&apos;ll rebuild it as a Nestudio object for your home.</p>
      </div>
      <button type="button" onClick={onCamera} className="spring stagger flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/75 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cobalt/40 hover:shadow-md" style={{ animationDelay: "40ms" }}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt/12 text-cobalt"><Camera className="h-5 w-5" /></span>
        <span><span className="block text-sm font-black text-ink">Camera</span><span className="block text-xs text-ink/55">Take a photo now</span></span>
      </button>
      <button type="button" onClick={onLibrary} className="spring stagger flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/75 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cobalt/40 hover:shadow-md" style={{ animationDelay: "100ms" }}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-saffron/15 text-saffron"><ImageIcon className="h-5 w-5" /></span>
        <span><span className="block text-sm font-black text-ink">Photo Library</span><span className="block text-xs text-ink/55">Choose an existing photo</span></span>
      </button>
    </div>
  );
}

function PreviewStep({ src, onContinue, onRetake }: { src: string; onContinue: () => void; onRetake: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col pt-2">
      <div className="fade-in overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Your photo" className="max-h-[54vh] w-full object-contain" draggable={false} />
      </div>
      <p className="mt-3 text-center text-sm text-ink/55">Looks good? Next, tap the object you want.</p>
      <button type="button" onClick={onContinue} className="spring mt-3 w-full rounded-full bg-cobalt py-3.5 text-sm font-black text-white shadow">Continue</button>
      <button type="button" onClick={onRetake} className="spring mt-2 w-full rounded-full py-2.5 text-sm font-bold text-ink/55 hover:bg-ink/5">Choose another photo</button>
    </div>
  );
}

/* ── Segmentation (tap-to-select) ────────────────────────────────────────────── */

function SegmentStep({
  sourceUrl,
  subject,
  onSubjectChange,
  onGenerate,
}: {
  sourceUrl: string;
  subject: string;
  onSubjectChange: (s: string) => void;
  onGenerate: (cutout: RasterImage, extra?: { original?: RasterImage; mask?: RasterImage }) => void;
}) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [original, setOriginal] = useState<RasterImage | null>(null);
  const [frame, setFrame] = useState<RasterImage | null>(null); // aligned overlay
  const [cutout, setCutout] = useState<RasterImage | null>(null); // trimmed, for generate
  const [committed, setCommitted] = useState<RasterImage | null>(null); // after edge-edit
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [preparing, setPreparing] = useState(true);
  const [working, setWorking] = useState(false);
  const [mode, setMode] = useState<"select" | "edges">("select");
  const [popKey, setPopKey] = useState(0);
  const [tapped, setTapped] = useState(false);
  const segRef = useRef<Segmenter | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const applyMask = useCallback(async (c: HTMLCanvasElement, mask: SegMask) => {
    const [fr, cut] = await Promise.all([maskToFrame(c, mask), maskToCutout(c, mask)]);
    setFrame(fr);
    setCutout(cut);
    setPopKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await sourceToCanvas(sourceUrl);
      if (!alive) return;
      setCanvas(c);
      setOriginal(toRaster(c));
      const seg = await getSegmenter();
      if (!alive) return;
      segRef.current = seg;
      let objs: DetectedObject[] = [];
      try { objs = await seg.detect(c); } catch { /* fall through */ }
      if (!alive) return;
      setObjects(objs);
      let mask: SegMask | null = objs[0]?.mask ?? null;
      if (!mask) { try { mask = await seg.segmentAtPoint(c, { x: 0.5, y: 0.5 }); } catch { /* none */ } }
      if (mask && alive) await applyMask(c, mask);
      if (alive) setPreparing(false);
    })();
    return () => { alive = false; };
  }, [sourceUrl, applyMask]);

  const onTapStage = async (e: React.PointerEvent) => {
    if (!canvas || !segRef.current || mode !== "select" || working) return;
    const stage = stageRef.current!;
    const rect = stage.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * stage.clientWidth;
    const py = ((e.clientY - rect.top) / rect.height) * stage.clientHeight;
    const srcPt = displayToSource({ x: px, y: py }, { width: stage.clientWidth, height: stage.clientHeight }, { width: canvas.width, height: canvas.height });
    const p = { x: srcPt.x / canvas.width, y: srcPt.y / canvas.height };
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
    setTapped(true);
    setWorking(true);
    try {
      const mask = await segRef.current.segmentAtPoint(canvas, p);
      await applyMask(canvas, mask);
    } catch { /* keep previous */ }
    setWorking(false);
  };

  const usingCutout = committed ?? cutout;

  // Centroid dots for other detected objects (tap hints).
  const dots = objects
    .map((o) => {
      const b = maskBBox(o.mask);
      if (!b) return null;
      return { id: o.id, cx: (b.x + b.w / 2) / o.mask.width, cy: (b.y + b.h / 2) / o.mask.height };
    })
    .filter(Boolean) as { id: string; cx: number; cy: number }[];

  if (mode === "edges" && frame && original) {
    return (
      <EdgeEditor
        frame={frame}
        original={original}
        onDone={(edited) => { setCommitted(edited); setCutout(edited); setMode("select"); }}
        onCancel={() => setMode("select")}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col pt-1">
      {/* Warm Nestudio paper card — the object floats on it, no giant checkerboard. */}
      <div ref={stageRef} onPointerDown={onTapStage} className="paper-card relative mx-auto aspect-square w-full max-w-[340px] cursor-pointer select-none overflow-hidden rounded-[26px]">
        {committed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={popKey} src={committed.dataUrl} alt="Your object" className="seg-pop absolute inset-0 m-auto max-h-[86%] max-w-[86%] object-contain drop-shadow-[0_10px_20px_rgba(56,41,29,0.28)]" draggable={false} />
        ) : (
          <>
            {/* Faded, desaturated background */}
            {original ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={original.dataUrl} alt="" className="seg-bg absolute inset-0 h-full w-full object-contain" draggable={false} />
            ) : null}
            {/* Bright, glowing selected object aligned on top */}
            {frame ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={popKey} src={frame.dataUrl} alt="Selected object" className="seg-pop absolute inset-0 h-full w-full object-contain drop-shadow-[0_0_10px_rgba(47,111,214,0.55)]" draggable={false} />
            ) : null}
            {/* Tap hints on other detected objects */}
            {!tapped && dots.slice(1, 4).map((d) => (
              <span key={d.id} className="seg-dot" style={{ left: `${d.cx * 100}%`, top: `${d.cy * 100}%` }} aria-hidden />
            ))}
            {/* Subtle shimmer while thinking — never a spinner */}
            {(preparing || working) ? <div className="seg-shimmer absolute inset-0" aria-hidden /> : null}
          </>
        )}
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink/50">
        <Hand className="h-3.5 w-3.5" />
        {committed ? "Edges tidied." : preparing ? "Finding objects…" : "Tap the object you want."}
      </div>

      <input
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
        placeholder="What is it? e.g. coffee mug"
        aria-label="What is it?"
        className="mt-3 w-full rounded-2xl border border-ink/12 bg-white/85 px-4 py-3 text-base text-ink shadow-sm focus:border-cobalt focus:outline-none"
      />
      <button type="button" onClick={() => usingCutout && onGenerate(usingCutout, { original: original ?? undefined, mask: frame ?? undefined })} disabled={!usingCutout} className="spring mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-cobalt py-3.5 text-sm font-black text-white shadow disabled:opacity-40">
        <Wand2 className="h-4 w-4" /> Generate
      </button>
      <button type="button" onClick={() => setMode("edges")} disabled={!frame} className="spring mt-2 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-bold text-ink/55 hover:bg-ink/5 disabled:opacity-40">
        <Pencil className="h-3.5 w-3.5" /> Fix edges
      </button>
    </div>
  );
}

/* ── Generating / result / refine / success ─────────────────────────────────── */

function GeneratingStep() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => Math.min(n + 1, STAGES.length - 1)), 1100);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center gap-5 pt-24 text-center">
      <div className="craft-orb" aria-hidden />
      <div className="h-6">
        {STAGES.map((s, idx) => (
          <p key={s} className="text-sm font-bold text-ink transition-all duration-500" style={{ display: idx === i ? "block" : "none" }}>{s}…</p>
        ))}
      </div>
      <p className="text-xs text-ink/40">Handcrafting your object</p>
    </div>
  );
}

function ResultStep({ result, note, onUse, onImprove }: { result: AssetCandidate; note: string | null; onUse: () => void; onImprove: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col pt-2">
      <div className="paper-card pop-in relative mx-auto flex aspect-square w-full max-w-[340px] items-center justify-center overflow-hidden rounded-[26px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result.image.dataUrl} alt="Your new Nestudio object" className="max-h-[86%] max-w-[86%] object-contain drop-shadow-[0_10px_20px_rgba(56,41,29,0.28)]" draggable={false} />
      </div>
      {note ? <p className="mt-2 text-center text-[11px] text-ink/45">{note}</p> : null}
      <p className="mt-3 text-center text-sm font-bold text-ink">Looks good?</p>
      <button type="button" onClick={onUse} className="spring mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-cobalt py-3.5 text-sm font-black text-white shadow"><Check className="h-4 w-4" /> Use it</button>
      <button type="button" onClick={onImprove} className="spring mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-ink/12 bg-white/70 py-3 text-sm font-black text-ink/70 hover:bg-white"><Wand2 className="h-4 w-4" /> Improve</button>
    </div>
  );
}

function RefineStep({ value, onChange, onCancel, onSubmit }: { value: string; onChange: (s: string) => void; onCancel: () => void; onSubmit: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col pt-4">
      <p className="text-center text-lg font-black tracking-tight text-ink">What would you like to change?</p>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder="Tell the artist in a few words…" aria-label="What would you like to change?" className="mt-3 w-full resize-none rounded-2xl border border-ink/12 bg-white/85 px-4 py-3 text-base text-ink shadow-sm focus:border-cobalt focus:outline-none" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REFINE_EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => onChange(ex)} className="spring rounded-full border border-ink/12 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ink/60 hover:border-cobalt/40 hover:text-ink">{ex}</button>
        ))}
      </div>
      <button type="button" onClick={onSubmit} disabled={!value.trim()} className="spring mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-cobalt py-3.5 text-sm font-black text-white shadow disabled:opacity-40"><Sparkles className="h-4 w-4" /> Regenerate</button>
      <button type="button" onClick={onCancel} className="spring mt-2 w-full rounded-full py-2.5 text-sm font-bold text-ink/55 hover:bg-ink/5">Keep this one</button>
    </div>
  );
}

function SuccessStep() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 pt-28 text-center">
      <div className="success-badge relative flex h-20 w-20 items-center justify-center rounded-full bg-cobalt text-white shadow-lg">
        <Check className="h-9 w-9" strokeWidth={3} />
        <Sparkles className="sparkle absolute -right-1 -top-1 h-5 w-5 text-saffron" />
      </div>
      <p className="fade-in text-base font-black tracking-tight text-ink">Added to My Assets</p>
    </div>
  );
}

/* ── Edge editor (fallback — only when the user taps "Fix edges") ─────────────── */

function EdgeEditor({ frame, original, onDone, onCancel }: { frame: RasterImage; original: RasterImage; onDone: (edited: RasterImage) => void; onCancel: () => void }) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const origRef = useRef<HTMLCanvasElement | null>(null);
  const undoRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const [mode, setMode] = useState<BrushMode>("erase");
  const [radius, setRadius] = useState(40);
  const [ready, setReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [frameImg, origImg] = await Promise.all([loadImage(frame.dataUrl), loadImage(original.dataUrl)]);
      if (cancelled) return;
      const mask = makeCanvas(original.width, original.height);
      mask.getContext("2d")!.drawImage(frameImg, 0, 0, original.width, original.height);
      maskRef.current = mask;
      const orig = makeCanvas(original.width, original.height);
      orig.getContext("2d")!.drawImage(origImg, 0, 0, original.width, original.height);
      origRef.current = orig;
      setReady(true);
      redraw();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, original]);

  const snapshot = () => {
    const m = maskRef.current!;
    undoRef.current.push(m.getContext("2d")!.getImageData(0, 0, m.width, m.height));
    if (undoRef.current.length > 20) undoRef.current.shift();
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };
  const undo = () => {
    const m = maskRef.current!;
    if (!undoRef.current.length) return;
    redoRef.current.push(m.getContext("2d")!.getImageData(0, 0, m.width, m.height));
    m.getContext("2d")!.putImageData(undoRef.current.pop()!, 0, 0);
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(true);
    redraw();
  };
  const redo = () => {
    const m = maskRef.current!;
    if (!redoRef.current.length) return;
    undoRef.current.push(m.getContext("2d")!.getImageData(0, 0, m.width, m.height));
    m.getContext("2d")!.putImageData(redoRef.current.pop()!, 0, 0);
    setCanRedo(redoRef.current.length > 0);
    setCanUndo(true);
    redraw();
  };

  const redraw = () => {
    const view = viewRef.current, mask = maskRef.current, orig = origRef.current;
    if (!view || !mask || !orig) return;
    const ctx = view.getContext("2d")!;
    ctx.clearRect(0, 0, view.width, view.height);
    const temp = makeCanvas(orig.width, orig.height);
    const tctx = temp.getContext("2d")!;
    tctx.drawImage(orig, 0, 0);
    tctx.globalCompositeOperation = "destination-in";
    tctx.drawImage(mask, 0, 0);
    const scale = Math.min(view.width / orig.width, view.height / orig.height);
    const w = orig.width * scale, h = orig.height * scale;
    ctx.drawImage(temp, (view.width - w) / 2, (view.height - h) / 2, w, h);
  };

  const stamp = (sx: number, sy: number) => {
    const mask = maskRef.current;
    if (!mask) return;
    const mctx = mask.getContext("2d")!;
    mctx.save();
    mctx.beginPath();
    mctx.arc(sx, sy, clampBrush(radius), 0, Math.PI * 2);
    if (mode === "erase") { mctx.globalCompositeOperation = "destination-out"; mctx.fillStyle = "#000"; }
    else { mctx.globalCompositeOperation = "source-over"; mctx.fillStyle = "#fff"; }
    mctx.fill();
    mctx.restore();
  };

  const pointerToSource = (e: React.PointerEvent) => {
    const view = viewRef.current!;
    const rect = view.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * view.width;
    const py = ((e.clientY - rect.top) / rect.height) * view.height;
    return displayToSource({ x: px, y: py }, { width: view.width, height: view.height }, { width: original.width, height: original.height });
  };
  const onDown = (e: React.PointerEvent) => { if (!ready) return; (e.target as HTMLElement).setPointerCapture(e.pointerId); snapshot(); const p = pointerToSource(e); last.current = p; stamp(p.x, p.y); redraw(); };
  const onMove = (e: React.PointerEvent) => { if (!last.current) return; const p = pointerToSource(e); for (const q of pointsAlongStroke(last.current, p, clampBrush(radius) * CUTOUT_DEFAULTS.stampSpacing)) stamp(q.x, q.y); last.current = p; redraw(); };
  const onUp = () => { last.current = null; };

  const done = async () => { if (!maskRef.current) return; onDone(await compositeMask(original, maskRef.current)); };

  return (
    <div className="mx-auto max-w-sm pt-1">
      <p className="mb-2 text-center text-xs text-ink/55">Brush only to fix edges — erase extra, restore what got cut.</p>
      <div className="paper-card relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-[26px]">
        <canvas ref={viewRef} width={340} height={340} className="h-full w-full touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} />
        {!ready ? <div className="absolute inset-0 flex items-center justify-center"><div className="craft-orb craft-orb--sm" /></div> : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex rounded-full border border-ink/10 bg-white/75 p-0.5">
          <button type="button" onClick={() => setMode("erase")} aria-pressed={mode === "erase"} className={`spring flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${mode === "erase" ? "bg-ink text-parchment" : "text-ink/55"}`}><Eraser className="h-3.5 w-3.5" /> Erase</button>
          <button type="button" onClick={() => setMode("restore")} aria-pressed={mode === "restore"} className={`spring flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${mode === "restore" ? "bg-ink text-parchment" : "text-ink/55"}`}><Brush className="h-3.5 w-3.5" /> Restore</button>
        </div>
        <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" className="spring rounded-full border border-ink/10 bg-white/75 p-2 text-ink/60 hover:bg-ink/5 disabled:opacity-35"><RotateCcw className="h-4 w-4" /></button>
        <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo" className="spring rounded-full border border-ink/10 bg-white/75 p-2 text-ink/60 hover:bg-ink/5 disabled:opacity-35"><RotateCcw className="h-4 w-4 -scale-x-100" /></button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Brush className="h-3.5 w-3.5 text-ink/40" />
        <input type="range" min={CUTOUT_DEFAULTS.minBrush} max={CUTOUT_DEFAULTS.maxBrush} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Brush size" className="flex-1 accent-cobalt" />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="spring flex-1 rounded-full border border-ink/12 py-3 text-sm font-bold text-ink/60 hover:bg-ink/5">Cancel</button>
        <button type="button" onClick={done} disabled={!ready} className="spring flex-[2] rounded-full bg-cobalt py-3 text-sm font-black text-white shadow disabled:opacity-40">Done</button>
      </div>
    </div>
  );
}

/* ── styles ──────────────────────────────────────────────────────────────────── */

function StyleBlock() {
  return (
    <style>{`
      .asset-backdrop{background:rgba(38,28,20,0.44);backdrop-filter:blur(24px) saturate(0.7) brightness(0.88);-webkit-backdrop-filter:blur(24px) saturate(0.7) brightness(0.88);animation:backdropIn 220ms ease both}
      .asset-card{animation:cardIn 240ms cubic-bezier(0.2,0.8,0.2,1) both}
      .paper-card{background:radial-gradient(130% 130% at 32% 22%,#fffdf8 0%,#f3ead9 68%,#ecdfc8 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.6),0 10px 30px -12px rgba(56,41,29,0.3)}
      .seg-bg{filter:brightness(0.5) saturate(0.35) blur(0.4px);transition:filter 320ms ease}
      .seg-pop{animation:segPop 340ms cubic-bezier(0.2,1.1,0.35,1) both}
      .seg-dot{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:9999px;background:rgba(47,111,214,0.5);box-shadow:0 0 0 0 rgba(47,111,214,0.4);animation:segDot 1.8s ease-in-out infinite}
      .seg-shimmer{background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,0.35) 50%,transparent 70%);background-size:220% 100%;animation:segShimmer 1.1s ease-in-out infinite;pointer-events:none}
      .spring{transition:transform 140ms cubic-bezier(0.2,0.8,0.2,1)}
      .spring:active{transform:scale(0.95)}
      .fade-in{animation:fadeIn 300ms ease both}
      .pop-in{animation:popIn 320ms cubic-bezier(0.2,1.1,0.35,1) both}
      .stagger{animation:popIn 320ms cubic-bezier(0.2,1.1,0.35,1) both}
      .craft-orb{width:42px;height:42px;border-radius:9999px;background:conic-gradient(from 0deg,#2f6fd6,#f6d8a8,#2f6fd6);-webkit-mask:radial-gradient(farthest-side,transparent 62%,#000 64%);mask:radial-gradient(farthest-side,transparent 62%,#000 64%);animation:spin 1s linear infinite}
      .craft-orb--sm{width:28px;height:28px}
      .success-badge{animation:badgePop 520ms cubic-bezier(0.2,1.3,0.4,1) both}
      .sparkle{animation:sparkle 700ms ease-out both}
      @keyframes backdropIn{from{opacity:0}to{opacity:1}}
      @keyframes cardIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      @keyframes popIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
      @keyframes segPop{0%{opacity:0.4;transform:scale(0.97)}60%{transform:scale(1.03)}100%{opacity:1;transform:scale(1)}}
      @keyframes segDot{0%,100%{box-shadow:0 0 0 0 rgba(47,111,214,0.45)}50%{box-shadow:0 0 0 7px rgba(47,111,214,0)}}
      @keyframes segShimmer{from{background-position:220% 0}to{background-position:-120% 0}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes badgePop{0%{opacity:0;transform:scale(0.4)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
      @keyframes sparkle{0%{opacity:0;transform:scale(0.4) rotate(-20deg)}60%{opacity:1;transform:scale(1.2) rotate(10deg)}100%{opacity:0.9;transform:scale(1) rotate(0)}}
      @media (prefers-reduced-motion:reduce){.asset-card,.asset-backdrop,.fade-in,.pop-in,.stagger,.success-badge,.sparkle,.seg-pop,.seg-dot,.seg-shimmer{animation:none!important}.spring{transition:none}.craft-orb{animation:spin 1s linear infinite}}
    `}</style>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
