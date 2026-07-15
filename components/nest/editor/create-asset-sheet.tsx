"use client";

/**
 * CreateAssetSheet — the editor-first asset factory (M32), polished into a premium
 * creative workspace (M31 polish sprint).
 *
 * Flow (original-photo-first, auto-cutout-first, single generation, refine-not-pick):
 *   Source → LARGE original photo (Continue) → AUTO cutout ("Looks good?") →
 *   [Edit cutout — fallback only] → Generate ONE → Result ("Use" / "Improve") →
 *   [Improve: what to change → regenerate one, reusing the result as reference] →
 *   Success ✨ → back to the editor, the new asset waiting in My Assets.
 *
 * No AI/prompt/model/pipeline changes here — this is UX, interaction and motion only.
 * The generation still runs through the provider-independent lib/asset-pipeline.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Eraser, Brush, RotateCcw, Check, X, Sparkles, ArrowLeft, Wand2, Pencil } from "lucide-react";
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
import { generateAsset, inventoryAssetFromCandidate, type AssetCandidate } from "@/lib/asset-pipeline";
import { inventory } from "@/lib/ai-inventory";

type Step = "source" | "preview" | "cutout" | "cleanup" | "generating" | "result" | "refine" | "success";
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
  const [original, setOriginal] = useState<RasterImage | null>(null);
  const [cutout, setCutout] = useState<RasterImage | null>(null);
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
    setOriginal(null);
    setCutout(null);
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
      setStep("preview"); // ORIGINAL first — the user's anchor of trust
    } catch (e) {
      setError(`Couldn't read that photo: ${(e as Error).message}`);
    }
  };

  // Continue from the original → run the auto-cutout (the editor never opens first).
  const onContinue = async () => {
    if (!sourceUrl) return;
    setStep("cutout");
    setCutout(null);
    try {
      const { cutout: c, original: o } = await autoCutout(sourceUrl);
      setOriginal(o);
      setCutout(c);
    } catch (e) {
      setError(`Couldn't prepare the cutout: ${(e as Error).message}`);
      setStep("preview");
    }
  };

  const runGenerate = async (inputCutout: RasterImage, notes?: string) => {
    setStep("generating");
    setError(null);
    setFallbackNote(null);
    try {
      const res = await generateAsset(
        { cutout: inputCutout, subject: subject.trim() || "object", notes, variants: 1 },
        { allowFallback: true },
      );
      if (res.candidates.length === 0) {
        setError(res.error ?? "That didn't work — let's try once more.");
        setStep(notes ? "refine" : "cutout");
        return;
      }
      if (res.usedFallback) setFallbackNote("Made offline — reconnect for the best result.");
      setResult(res.candidates[0]);
      setStep("result");
    } catch (e) {
      setError((e as Error).message);
      setStep(notes ? "refine" : "cutout");
    }
  };

  const onUse = async () => {
    if (!result) return;
    // Save first so the id exists, then celebrate, then hand back to the editor.
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
      {/* Premium glass backdrop: strong blur, dim, desaturate, darken. */}
      <div className="asset-backdrop absolute inset-0" onClick={step === "source" ? onClose : undefined} aria-hidden />

      {/* Floating glass card */}
      <div className="asset-card relative z-10 flex w-full max-w-md flex-col overflow-hidden bg-parchment/85 shadow-[0_20px_60px_-15px_rgba(56,41,29,0.45)] sm:max-h-[92vh] sm:rounded-[28px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.85rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={step === "source" ? onClose : reset}
            aria-label={step === "source" ? "Close" : "Start over"}
            className="spring rounded-full p-2 text-ink/55 hover:bg-ink/5"
          >
            {canGoBack ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </button>
          <p className="text-sm font-black tracking-tight text-ink">Create asset</p>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))]">
          {error ? (
            <p className="mx-auto mb-3 max-w-sm rounded-2xl border border-rust/25 bg-rust/10 px-3 py-2 text-center text-xs font-semibold text-rust">{error}</p>
          ) : null}

          {step === "source" ? <SourceStep onCamera={() => cameraRef.current?.click()} onLibrary={() => libraryRef.current?.click()} /> : null}

          {step === "preview" && sourceUrl ? <PreviewStep src={sourceUrl} onContinue={onContinue} onRetake={reset} /> : null}

          {step === "cutout" ? (
            <CutoutConfirmStep
              cutout={cutout}
              subject={subject}
              onSubjectChange={setSubject}
              onGenerate={() => cutout && runGenerate(cutout)}
              onEdit={() => setStep("cleanup")}
            />
          ) : null}

          {step === "cleanup" && cutout && original ? (
            <CleanupStep cutout={cutout} original={original} onDone={(edited) => { setCutout(edited); setStep("cutout"); }} />
          ) : null}

          {step === "generating" ? <GeneratingStep /> : null}

          {step === "result" && result ? (
            <ResultStep result={result} note={fallbackNote} onUse={onUse} onImprove={() => setStep("refine")} />
          ) : null}

          {step === "refine" && result ? (
            <RefineStep
              value={refineText}
              onChange={setRefineText}
              onCancel={() => setStep("result")}
              onSubmit={() => runGenerate(result.image, refineText.trim())}
            />
          ) : null}

          {step === "success" ? <SuccessStep /> : null}
        </div>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void onPickFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPickFile(e.target.files?.[0]); e.target.value = ""; }} />

      <StyleBlock />
    </div>
  );
}

/* ── Steps ───────────────────────────────────────────────────────────────────── */

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
        <img src={src} alt="Your photo" className="max-h-[52vh] w-full object-contain" draggable={false} />
      </div>
      <p className="mt-3 text-center text-sm text-ink/55">Looks good? We&apos;ll cut it out next.</p>
      <button type="button" onClick={onContinue} className="spring mt-3 w-full rounded-full bg-cobalt py-3.5 text-sm font-black text-white shadow">Continue</button>
      <button type="button" onClick={onRetake} className="spring mt-2 w-full rounded-full py-2.5 text-sm font-bold text-ink/55 hover:bg-ink/5">Choose another photo</button>
    </div>
  );
}

function CutoutConfirmStep({
  cutout,
  subject,
  onSubjectChange,
  onGenerate,
  onEdit,
}: {
  cutout: RasterImage | null;
  subject: string;
  onSubjectChange: (s: string) => void;
  onGenerate: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col pt-2">
      <div className="soft-surface fade-in relative mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-3xl border border-ink/8">
        {cutout ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cutout.dataUrl} alt="Cutout preview" className="pop-in max-h-[88%] max-w-[88%] object-contain" draggable={false} />
        ) : (
          <Spinner label="Cutting it out…" />
        )}
      </div>

      {cutout ? (
        <>
          <p className="mt-3 text-center text-sm font-bold text-ink">Looks good?</p>
          <input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="What is it? e.g. coffee mug"
            aria-label="What is it?"
            className="mt-2 w-full rounded-2xl border border-ink/12 bg-white/85 px-4 py-3 text-base text-ink shadow-sm focus:border-cobalt focus:outline-none"
          />
          <button type="button" onClick={onGenerate} className="spring mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-cobalt py-3.5 text-sm font-black text-white shadow">
            <Wand2 className="h-4 w-4" /> Generate
          </button>
          <button type="button" onClick={onEdit} className="spring mt-2 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-bold text-ink/55 hover:bg-ink/5">
            <Pencil className="h-3.5 w-3.5" /> Edit cutout
          </button>
        </>
      ) : null}
    </div>
  );
}

function GeneratingStep() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => Math.min(n + 1, STAGES.length - 1)), 1100);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center gap-5 pt-24 text-center">
      <div className="craft-orb" aria-hidden />
      <div className="h-6 overflow-hidden">
        {STAGES.map((s, idx) => (
          <p key={s} className={`text-sm font-bold text-ink transition-all duration-500 ${idx === i ? "translate-y-0 opacity-100" : "absolute translate-y-2 opacity-0"}`} style={{ display: idx === i ? "block" : "none" }}>
            {s}…
          </p>
        ))}
      </div>
      <p className="text-xs text-ink/40">Handcrafting your object</p>
    </div>
  );
}

function ResultStep({ result, note, onUse, onImprove }: { result: AssetCandidate; note: string | null; onUse: () => void; onImprove: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col pt-2">
      <div className="soft-surface pop-in relative mx-auto flex aspect-square w-full max-w-[330px] items-center justify-center overflow-hidden rounded-3xl border border-ink/8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result.image.dataUrl} alt="Your new Nestudio object" className="max-h-[88%] max-w-[88%] object-contain" draggable={false} />
      </div>
      {note ? <p className="mt-2 text-center text-[11px] text-ink/45">{note}</p> : null}
      <p className="mt-3 text-center text-sm font-bold text-ink">Looks good?</p>
      <button type="button" onClick={onUse} className="spring mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-cobalt py-3.5 text-sm font-black text-white shadow">
        <Check className="h-4 w-4" /> Use it
      </button>
      <button type="button" onClick={onImprove} className="spring mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-ink/12 bg-white/70 py-3 text-sm font-black text-ink/70 hover:bg-white">
        <Wand2 className="h-4 w-4" /> Improve
      </button>
    </div>
  );
}

function RefineStep({ value, onChange, onCancel, onSubmit }: { value: string; onChange: (s: string) => void; onCancel: () => void; onSubmit: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col pt-4">
      <p className="text-center text-lg font-black tracking-tight text-ink">What would you like to change?</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Tell the artist in a few words…"
        aria-label="What would you like to change?"
        className="mt-3 w-full resize-none rounded-2xl border border-ink/12 bg-white/85 px-4 py-3 text-base text-ink shadow-sm focus:border-cobalt focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REFINE_EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => onChange(ex)} className="spring rounded-full border border-ink/12 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ink/60 hover:border-cobalt/40 hover:text-ink">
            {ex}
          </button>
        ))}
      </div>
      <button type="button" onClick={onSubmit} disabled={!value.trim()} className="spring mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-cobalt py-3.5 text-sm font-black text-white shadow disabled:opacity-40">
        <Sparkles className="h-4 w-4" /> Regenerate
      </button>
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

/* ── Cleanup (fallback erase/restore brush) ──────────────────────────────────── */

function CleanupStep({ cutout, original, onDone }: { cutout: RasterImage; original: RasterImage; onDone: (edited: RasterImage) => void }) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const origRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<BrushMode>("erase");
  const [radius, setRadius] = useState(48);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cutImg, origImg] = await Promise.all([loadImage(cutout.dataUrl), loadImage(original.dataUrl)]);
      if (cancelled) return;
      const mask = makeCanvas(original.width, original.height);
      mask.getContext("2d")!.drawImage(cutImg, 0, 0, original.width, original.height);
      maskRef.current = mask;
      const orig = makeCanvas(original.width, original.height);
      orig.getContext("2d")!.drawImage(origImg, 0, 0, original.width, original.height);
      origRef.current = orig;
      setReady(true);
      redraw();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutout, original]);

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

  const onDown = (e: React.PointerEvent) => { if (!ready) return; (e.target as HTMLElement).setPointerCapture(e.pointerId); const p = pointerToSource(e); last.current = p; stamp(p.x, p.y); redraw(); };
  const onMove = (e: React.PointerEvent) => { if (!last.current) return; const p = pointerToSource(e); for (const q of pointsAlongStroke(last.current, p, clampBrush(radius) * CUTOUT_DEFAULTS.stampSpacing)) stamp(q.x, q.y); last.current = p; redraw(); };
  const onUp = () => { last.current = null; };

  const resetMask = async () => {
    const cutImg = await loadImage(cutout.dataUrl);
    const mask = makeCanvas(original.width, original.height);
    mask.getContext("2d")!.drawImage(cutImg, 0, 0, original.width, original.height);
    maskRef.current = mask;
    redraw();
  };

  const done = async () => {
    if (!maskRef.current) return;
    setBusy(true);
    const edited = await compositeMask(original, maskRef.current);
    onDone(edited);
  };

  return (
    <div className="mx-auto max-w-sm pt-1">
      <p className="mb-2 text-center text-xs text-ink/55">Erase what shouldn&apos;t be there — restore anything the cut removed.</p>
      <div className="soft-surface relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-3xl border border-ink/8">
        <canvas ref={viewRef} width={320} height={320} className="h-full w-full touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} />
        {!ready ? <div className="absolute inset-0 flex items-center justify-center"><Spinner /></div> : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex rounded-full border border-ink/10 bg-white/75 p-0.5">
          <button type="button" onClick={() => setMode("erase")} aria-pressed={mode === "erase"} className={`spring flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${mode === "erase" ? "bg-ink text-parchment" : "text-ink/55"}`}><Eraser className="h-3.5 w-3.5" /> Erase</button>
          <button type="button" onClick={() => setMode("restore")} aria-pressed={mode === "restore"} className={`spring flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${mode === "restore" ? "bg-ink text-parchment" : "text-ink/55"}`}><Brush className="h-3.5 w-3.5" /> Restore</button>
        </div>
        <input type="range" min={CUTOUT_DEFAULTS.minBrush} max={CUTOUT_DEFAULTS.maxBrush} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Brush size" className="flex-1 accent-cobalt" />
        <button type="button" onClick={resetMask} aria-label="Reset cutout" className="spring rounded-full border border-ink/10 bg-white/75 p-2 text-ink/60 hover:bg-ink/5"><RotateCcw className="h-4 w-4" /></button>
      </div>
      <button type="button" onClick={done} disabled={busy || !ready} className="spring mt-4 w-full rounded-full bg-cobalt py-3.5 text-sm font-black text-white shadow disabled:opacity-40">Done</button>
    </div>
  );
}

/* ── bits ────────────────────────────────────────────────────────────────────── */

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="craft-orb craft-orb--sm" aria-hidden />
      {label ? <p className="text-xs font-semibold text-ink/50">{label}</p> : null}
    </div>
  );
}

function StyleBlock() {
  return (
    <style>{`
      .asset-backdrop{background:rgba(38,28,20,0.42);backdrop-filter:blur(22px) saturate(0.72) brightness(0.9);-webkit-backdrop-filter:blur(22px) saturate(0.72) brightness(0.9);animation:backdropIn 220ms ease both}
      .asset-card{animation:cardIn 220ms cubic-bezier(0.2,0.8,0.2,1) both}
      .soft-surface{background-color:#f6efe1;background-image:linear-gradient(45deg,#00000007 25%,transparent 25%,transparent 75%,#00000007 75%),linear-gradient(45deg,#00000007 25%,transparent 25%,transparent 75%,#00000007 75%),radial-gradient(120% 120% at 30% 20%,#fffdf8 0%,#f4ecdd 100%);background-size:12px 12px,12px 12px,100% 100%;background-position:0 0,6px 6px,0 0}
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
      @keyframes cardIn{from{opacity:0;transform:scale(0.96) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      @keyframes popIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes badgePop{0%{opacity:0;transform:scale(0.4)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
      @keyframes sparkle{0%{opacity:0;transform:scale(0.4) rotate(-20deg)}60%{opacity:1;transform:scale(1.2) rotate(10deg)}100%{opacity:0.9;transform:scale(1) rotate(0)}}
      @media (prefers-reduced-motion:reduce){.asset-card,.asset-backdrop,.fade-in,.pop-in,.stagger,.success-badge,.sparkle{animation:none!important}.spring{transition:none}.craft-orb{animation:spin 1s linear infinite}}
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
