"use client";

/**
 * CreateAssetSheet — the editor-first asset factory (M32).
 * -----------------------------------------------------------------------------
 * ONE flow, ONE place, never leaving the editor:
 *   Source (Camera / Photo Library) → AI Cutout → Quick Cleanup (erase/restore)
 *   → Generate → Choose → the asset appears immediately in the library.
 *
 * Telegram-INSPIRED interaction (fast, forgiving), NOT Telegram output — Stage 2
 * reinterprets the cutout into a Nestudio object via the provider-independent
 * asset-pipeline (the active provider is one config away). Cutout (Stage 1) and
 * generation (Stage 2) are deliberately separate concerns.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Eraser, Brush, RotateCcw, Loader2, Check, X, Sparkles, ArrowLeft } from "lucide-react";
import type { RasterImage } from "@/lib/ai/types";
import {
  autoCutout,
  compositeMask,
  clampBrush,
  pointsAlongStroke,
  displayToSource,
  CUTOUT_DEFAULTS,
} from "@/lib/cutout";
import { loadImage, makeCanvas } from "@/lib/ai/canvas";
import { generateAsset, inventoryAssetFromCandidate, getAssetProvider, ACTIVE_ASSET_PROVIDER, type AssetCandidate } from "@/lib/asset-pipeline";
import { inventory } from "@/lib/ai-inventory";

type Step = "source" | "cutout" | "cleanup" | "generating" | "choose";
type BrushMode = "erase" | "restore";

const VARIANTS = 3;

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
  const [original, setOriginal] = useState<RasterImage | null>(null);
  const [cutout, setCutout] = useState<RasterImage | null>(null);
  const [subject, setSubject] = useState("");
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerNote, setProviderNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("source");
    setOriginal(null);
    setCutout(null);
    setSubject("");
    setCandidates([]);
    setChosen(null);
    setError(null);
    setProviderNote(null);
    setSaving(false);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStep("cutout");
    try {
      const dataUrl = await fileToDataUrl(file);
      const { cutout: c, original: o } = await autoCutout(dataUrl);
      setOriginal(o);
      setCutout(c);
      setStep("cleanup");
    } catch (e) {
      setError(`Couldn't read that photo: ${(e as Error).message}`);
      setStep("source");
    }
  };

  const onGenerate = async (finalCutout: RasterImage) => {
    setStep("generating");
    setError(null);
    setProviderNote(null);
    try {
      const res = await generateAsset(
        { cutout: finalCutout, subject: subject.trim() || "object", variants: VARIANTS },
        { allowFallback: true },
      );
      if (res.candidates.length === 0) {
        setError(res.error ?? "Generation produced no candidates. Try again.");
        setStep("cleanup");
        return;
      }
      const label = getAssetProvider(res.provider).label;
      setProviderNote(
        res.usedFallback
          ? `${getAssetProvider(res.requestedProvider).label} was unavailable — showing the local fallback (not a full reinterpretation).`
          : `Rebuilt by ${label}.`,
      );
      setCandidates(res.candidates);
      setChosen(0);
      setStep("choose");
    } catch (e) {
      setError((e as Error).message);
      setStep("cleanup");
    }
  };

  const onSave = async () => {
    if (chosen === null || !candidates[chosen]) return;
    setSaving(true);
    try {
      const asset = inventoryAssetFromCandidate(candidates[chosen], { subject: subject.trim() || "object" });
      await inventory.save(asset);
      onCreated(asset.id);
      onClose();
    } catch (e) {
      setError(`Couldn't save: ${(e as Error).message}`);
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-parchment/98 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create asset">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={step === "source" ? onClose : reset}
          aria-label={step === "source" ? "Close" : "Start over"}
          className="rounded-full p-2 text-ink/60 hover:bg-ink/5"
        >
          {step === "source" ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
        <p className="text-sm font-black tracking-tight text-ink">Create asset</p>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error ? (
          <p className="mx-auto mb-3 max-w-sm rounded-xl border border-rust/30 bg-rust/10 px-3 py-2 text-center text-xs font-semibold text-rust">{error}</p>
        ) : null}

        {step === "source" ? (
          <SourceStep
            onCamera={() => cameraRef.current?.click()}
            onLibrary={() => libraryRef.current?.click()}
          />
        ) : null}

        {step === "cutout" ? <Busy label="Cutting out your object…" /> : null}

        {step === "cleanup" && cutout && original ? (
          <CleanupStep
            cutout={cutout}
            original={original}
            subject={subject}
            onSubjectChange={setSubject}
            onGenerate={onGenerate}
          />
        ) : null}

        {step === "generating" ? <Busy label="Rebuilding it as a Nestudio object…" sub={`via ${getAssetProvider(ACTIVE_ASSET_PROVIDER).label}`} /> : null}

        {step === "choose" && candidates.length > 0 ? (
          <ChooseStep
            candidates={candidates}
            chosen={chosen}
            onChoose={setChosen}
            onSave={onSave}
            saving={saving}
            providerNote={providerNote}
          />
        ) : null}
      </div>

      {/* Hidden inputs — Camera prefers the rear camera; Library is the photo roll. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onPickFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPickFile(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

/* ── Steps ───────────────────────────────────────────────────────────────────── */

function SourceStep({ onCamera, onLibrary }: { onCamera: () => void; onLibrary: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 pt-8">
      <p className="text-center text-sm text-ink/60">Photograph a real thing you own — it becomes a Nestudio object in your home.</p>
      <button type="button" onClick={onCamera} className="flex items-center gap-3 rounded-2xl border border-ink/12 bg-white/80 p-4 text-left shadow-sm transition hover:border-cobalt/50">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cobalt/12 text-cobalt"><Camera className="h-5 w-5" /></span>
        <span><span className="block text-sm font-bold text-ink">Camera</span><span className="block text-xs text-ink/55">Take a photo now</span></span>
      </button>
      <button type="button" onClick={onLibrary} className="flex items-center gap-3 rounded-2xl border border-ink/12 bg-white/80 p-4 text-left shadow-sm transition hover:border-cobalt/50">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-saffron/15 text-saffron"><ImageIcon className="h-5 w-5" /></span>
        <span><span className="block text-sm font-bold text-ink">Photo Library</span><span className="block text-xs text-ink/55">Choose an existing photo</span></span>
      </button>
    </div>
  );
}

function Busy({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-cobalt" />
      <p className="text-sm font-semibold text-ink">{label}</p>
      {sub ? <p className="text-xs text-ink/50">{sub}</p> : null}
    </div>
  );
}

function ChooseStep({
  candidates,
  chosen,
  onChoose,
  onSave,
  saving,
  providerNote,
}: {
  candidates: AssetCandidate[];
  chosen: number | null;
  onChoose: (i: number) => void;
  onSave: () => void;
  saving: boolean;
  providerNote: string | null;
}) {
  return (
    <div className="mx-auto max-w-md pt-2">
      <p className="mb-1 text-center text-sm font-bold text-ink">Pick your favourite</p>
      {providerNote ? <p className="mb-3 text-center text-[11px] text-ink/45">{providerNote}</p> : null}
      <div className="grid grid-cols-3 gap-2">
        {candidates.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChoose(i)}
            aria-pressed={chosen === i}
            aria-label={`Candidate ${i + 1}`}
            className={`checker relative aspect-square overflow-hidden rounded-2xl border-2 transition ${chosen === i ? "border-cobalt ring-2 ring-cobalt/30" : "border-ink/10"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image.dataUrl} alt="" className="h-full w-full object-contain p-1" draggable={false} />
            {chosen === i ? <span className="absolute right-1 top-1 rounded-full bg-cobalt p-1 text-white"><Check className="h-3 w-3" /></span> : null}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={chosen === null || saving}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-cobalt py-3 text-sm font-black text-white shadow disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Add to my Nest
      </button>
      <style>{`.checker{background-image:linear-gradient(45deg,#0000000d 25%,transparent 25%,transparent 75%,#0000000d 75%),linear-gradient(45deg,#0000000d 25%,transparent 25%,transparent 75%,#0000000d 75%);background-size:16px 16px;background-position:0 0,8px 8px;background-color:#fff}`}</style>
    </div>
  );
}

/* ── Cleanup (Telegram-style erase/restore brush) ────────────────────────────── */

function CleanupStep({
  cutout,
  original,
  subject,
  onSubjectChange,
  onGenerate,
}: {
  cutout: RasterImage;
  original: RasterImage;
  subject: string;
  onSubjectChange: (s: string) => void;
  onGenerate: (finalCutout: RasterImage) => void;
}) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null); // full-res alpha stencil
  const origRef = useRef<HTMLCanvasElement | null>(null); // full-res original
  const [mode, setMode] = useState<BrushMode>("erase");
  const [radius, setRadius] = useState(48);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Initialise the offscreen mask from the auto-cutout's alpha, and the original.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cutImg, origImg] = await Promise.all([loadImage(cutout.dataUrl), loadImage(original.dataUrl)]);
      if (cancelled) return;
      const mask = makeCanvas(original.width, original.height);
      const mctx = mask.getContext("2d")!;
      // The cutout is trimmed/padded; draw it stretched over the original frame as the
      // starting stencil (opaque where the object is). It's a soft start, then the user
      // refines. For a faithful start we instead reproduce the alpha by drawing the
      // cutout scaled to cover — good enough as an editable seed.
      mctx.drawImage(cutImg, 0, 0, original.width, original.height);
      maskRef.current = mask;
      const orig = makeCanvas(original.width, original.height);
      orig.getContext("2d")!.drawImage(origImg, 0, 0, original.width, original.height);
      origRef.current = orig;
      setReady(true);
      redraw();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutout, original]);

  const redraw = () => {
    const view = viewRef.current;
    const mask = maskRef.current;
    const orig = origRef.current;
    if (!view || !mask || !orig) return;
    const ctx = view.getContext("2d")!;
    ctx.clearRect(0, 0, view.width, view.height);
    // composite original × mask into a temp, then draw object-contain into the view
    const temp = makeCanvas(orig.width, orig.height);
    const tctx = temp.getContext("2d")!;
    tctx.drawImage(orig, 0, 0);
    tctx.globalCompositeOperation = "destination-in";
    tctx.drawImage(mask, 0, 0);
    const scale = Math.min(view.width / orig.width, view.height / orig.height);
    const w = orig.width * scale;
    const h = orig.height * scale;
    ctx.drawImage(temp, (view.width - w) / 2, (view.height - h) / 2, w, h);
  };

  const stamp = (sx: number, sy: number) => {
    const mask = maskRef.current;
    if (!mask) return;
    const mctx = mask.getContext("2d")!;
    mctx.save();
    mctx.beginPath();
    mctx.arc(sx, sy, clampBrush(radius), 0, Math.PI * 2);
    if (mode === "erase") {
      mctx.globalCompositeOperation = "destination-out";
      mctx.fillStyle = "#000";
    } else {
      mctx.globalCompositeOperation = "source-over";
      mctx.fillStyle = "#fff"; // opaque → reveals original in composite
    }
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

  const onDown = (e: React.PointerEvent) => {
    if (!ready) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = pointerToSource(e);
    last.current = p;
    stamp(p.x, p.y);
    redraw();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!last.current) return;
    const p = pointerToSource(e);
    for (const q of pointsAlongStroke(last.current, p, clampBrush(radius) * CUTOUT_DEFAULTS.stampSpacing)) stamp(q.x, q.y);
    last.current = p;
    redraw();
  };
  const onUp = () => {
    last.current = null;
  };

  const resetMask = async () => {
    const cutImg = await loadImage(cutout.dataUrl);
    const mask = makeCanvas(original.width, original.height);
    mask.getContext("2d")!.drawImage(cutImg, 0, 0, original.width, original.height);
    maskRef.current = mask;
    redraw();
  };

  const proceed = async () => {
    if (!maskRef.current) return;
    setBusy(true);
    const finalCutout = await compositeMask(original, maskRef.current);
    onGenerate(finalCutout);
  };

  return (
    <div className="mx-auto max-w-md pt-1">
      <p className="mb-2 text-center text-xs text-ink/55">Tidy the cutout if needed, then generate. Erase what shouldn&apos;t be there; restore what got cut.</p>
      <div className="checker relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-2xl border border-ink/12">
        <canvas
          ref={viewRef}
          width={340}
          height={340}
          className="h-full w-full touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
        {!ready ? <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cobalt" /></div> : null}
      </div>

      {/* Brush controls */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex rounded-full border border-ink/12 bg-white/80 p-0.5">
          <button type="button" onClick={() => setMode("erase")} aria-pressed={mode === "erase"} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${mode === "erase" ? "bg-ink text-parchment" : "text-ink/55"}`}><Eraser className="h-3.5 w-3.5" /> Erase</button>
          <button type="button" onClick={() => setMode("restore")} aria-pressed={mode === "restore"} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${mode === "restore" ? "bg-ink text-parchment" : "text-ink/55"}`}><Brush className="h-3.5 w-3.5" /> Restore</button>
        </div>
        <input type="range" min={CUTOUT_DEFAULTS.minBrush} max={CUTOUT_DEFAULTS.maxBrush} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Brush size" className="flex-1 accent-cobalt" />
        <button type="button" onClick={resetMask} aria-label="Reset cutout" className="rounded-full border border-ink/12 bg-white/80 p-2 text-ink/60 hover:bg-ink/5"><RotateCcw className="h-4 w-4" /></button>
      </div>

      {/* Subject + generate */}
      <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-ink/45">What is it? (helps the artist)</label>
      <input
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
        placeholder="e.g. coffee mug, plant, sneaker"
        className="mt-1 w-full rounded-xl border border-ink/15 bg-white/85 px-3 py-2.5 text-base text-ink focus:border-cobalt focus:outline-none"
      />
      <button type="button" onClick={proceed} disabled={busy || !ready} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-cobalt py-3 text-sm font-black text-white shadow disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Generate {VARIANTS} designs
      </button>
      <style>{`.checker{background-image:linear-gradient(45deg,#0000000d 25%,transparent 25%,transparent 75%,#0000000d 75%),linear-gradient(45deg,#0000000d 25%,transparent 25%,transparent 75%,#0000000d 75%);background-size:16px 16px;background-position:0 0,8px 8px;background-color:#fff}`}</style>
    </div>
  );
}

/* ── util ────────────────────────────────────────────────────────────────────── */

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
