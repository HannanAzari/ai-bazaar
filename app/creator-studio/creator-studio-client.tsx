"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, Home, Loader2, RefreshCw, Sparkles, Trash2, Upload, Wand2, X } from "lucide-react";
import {
  generateAsset,
  STUDIO_CONFIGS,
  type GeneratedAsset,
  type ImageInput,
} from "@/lib/ai";
import { inventory, assetFromGenerated } from "@/lib/ai-inventory";
import { useInventory } from "@/lib/ai-inventory/react";
import { useDevMode, setDevMode } from "@/lib/dev-mode";
import { getBackgrounds, getTemplates, hydrateLibrary } from "@/lib/nest-production-library";
import { createFromBackground, createFromTemplate } from "@/lib/nest-repo";
import { listDrafts, setDocOwner } from "@/lib/nest-document-store";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { downscaleDataUrl } from "@/lib/image-downscale";

// ── AI Creator Studio · Vertical Slice 01 ────────────────────────────────────
// "My object became part of my home." Upload a real belonging → real hosted Gemini
// translates it into Nestudio DNA (true transparent PNG) → pick 1 of 3 candidates →
// save to inventory → Place in my Nest (opens the editor on a real draft so it
// persists on reopen). Mobile-first; the AI output is the hero. Furniture only.

const CHECKER = "repeating-conic-gradient(#00000010 0% 25%, transparent 0% 50%) 50% / 20px 20px";
const NEST_TINT = "linear-gradient(160deg,#f3e9d2,#e7d6ac)";
type Phase = "idle" | "generating" | "review" | "error";
type Detail = "preserve" | "simplify";

// VS01 correction — 3 genuinely different interpretations, not near-identical outputs.
const VARIANTS: { key: string; label: string; note: string }[] = [
  { key: "A", label: "Faithful", note: "" },
  { key: "B", label: "Designed", note: "Refine into a slightly simplified, more elegant and resolved form — smoother, cleaner, calmer surfaces — but unmistakably the same object with the same distinctive features." },
  { key: "C", label: "Characterful", note: "Push the friendly Nestudio proportions — a little chunkier, rounder and more playful — while clearly keeping the object's distinctive features and handmade personality." },
];
const CANDIDATE_COUNT = VARIANTS.length;
const MAX_TRIES = 3;

const SIMPLIFY_NOTE =
  "Remove all lettering, words and writing from the surface; keep the rounded body and the distinctive handle and overall identity.";
const PRESERVE_NOTE =
  "Keep the object's distinctive handle and any lettering, re-rendered as a simplified hand-painted mark on the matte surface.";

// Programmatic alpha inspection: the four corner pixels must be genuinely transparent,
// the object must not touch an edge, and it must not be a solid rectangle.
async function inspectAlpha(dataUrl: string): Promise<{ transparentCorners: boolean; edgeTouch: boolean; coverage: number }> {
  if (typeof document === "undefined") return { transparentCorners: true, edgeTouch: false, coverage: 0.3 };
  const img = await new Promise<HTMLImageElement>((res, rej) => { const el = new Image(); el.onload = () => res(el); el.onerror = () => rej(new Error("decode")); el.src = dataUrl; });
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); if (!ctx) return { transparentCorners: true, edgeTouch: false, coverage: 0.3 };
  ctx.drawImage(img, 0, 0);
  const p = ctx.getImageData(0, 0, w, h).data;
  const A = (x: number, y: number) => p[(y * w + x) * 4 + 3];
  const transparentCorners = [A(0, 0), A(w - 1, 0), A(0, h - 1), A(w - 1, h - 1)].every((a) => a === 0);
  let count = 0, edgeTouch = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (p[(y * w + x) * 4 + 3] > 24) { count++; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edgeTouch = true; } }
  return { transparentCorners, edgeTouch, coverage: count / (w * h) };
}

// Hard rejection gate: a candidate must be truly transparent, not clipped, and not a solid fill.
async function passesGate(a: GeneratedAsset): Promise<boolean> {
  const s = await inspectAlpha(a.png.dataUrl);
  return s.transparentCorners && !s.edgeTouch && s.coverage > 0.02 && s.coverage < 0.9;
}

export function CreatorStudioClient() {
  const router = useRouter();
  const { ownerId } = useNestIdentity();
  const history = useInventory();
  const dev = useDevMode();

  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState<Detail>("preserve");
  const [input, setInput] = useState<ImageInput | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [candidates, setCandidates] = useState<GeneratedAsset[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const config = STUDIO_CONFIGS.furniture;
  const chosen = useMemo(() => candidates.find((c) => c.id === chosenId) ?? null, [candidates, chosenId]);

  const pickFile = useCallback(async (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const raw = String(reader.result);
        // Resize before upload (speed + avoid huge HEIC/12MB data URLs) WITHOUT
        // destroying identity; keep the original for the side-by-side comparison.
        const resized = await downscaleDataUrl(raw, 1600);
        setInput({ dataUrl: resized, fileName: file.name, mimeType: "image/jpeg" });
        setCandidates([]); setChosenId(null); setSavedId(null); setPhase("idle");
      } catch {
        setError("That image couldn't be read. Try a JPG, PNG or WebP photo.");
      }
    };
    reader.onerror = () => setError("That image couldn't be read. Try another photo.");
    reader.readAsDataURL(file);
  }, []);

  const onGenerate = useCallback(async () => {
    if (!input) return;
    setPhase("generating"); setError(null); setCandidates([]); setChosenId(null); setSavedId(null); setProgress(0);
    const detailNote = detail === "simplify" ? SIMPLIFY_NOTE : PRESERVE_NOTE;
    const out: GeneratedAsset[] = [];
    let rejected = 0;
    let lastErr = "";
    try {
      for (let i = 0; i < CANDIDATE_COUNT; i++) {
        const notes = [VARIANTS[i].note, detailNote].filter(Boolean).join(" ");
        let accepted: GeneratedAsset | null = null;
        for (let t = 0; t < MAX_TRIES && !accepted; t++) {
          try {
            const g = await generateAsset("furniture", input, { subject, notes });
            if (await passesGate(g)) accepted = g; else rejected++;
          } catch (e) { lastErr = (e as Error).message; }
        }
        if (accepted) { out.push(accepted); setCandidates([...out]); }
        setProgress(i + 1);
      }
      if (!out.length) { setError(lastErr || "Generation failed the transparency gate — please try again."); setPhase("error"); return; }
      setPhase("review");
      if (rejected) setError(`${rejected} weak candidate${rejected === 1 ? "" : "s"} auto-rejected (opaque / clipped / no clean cut-out).`);
    } catch (e) {
      if (out.length) { setPhase("review"); } else { setError((e as Error).message); setPhase("error"); }
    }
  }, [input, subject, detail]);

  const onChoose = useCallback((g: GeneratedAsset) => {
    // Selection ONLY — A/B/C stay in component state during comparison. Nothing is
    // written to personal inventory until the user commits via "Place in my Nest",
    // so only the ONE chosen candidate ever persists.
    setChosenId(g.id);
    setSavedId(null);
  }, []);

  async function ensureDraftId(): Promise<string | undefined> {
    const existing = listDrafts(ownerId);
    if (existing.length) return existing[0].id; // continue the most recent Nest
    await hydrateLibrary();
    const tpls = getTemplates({ onlyVisible: true });
    if (tpls.length) {
      const doc = await createFromTemplate(tpls[0].id);
      if (doc) { if (ownerId) setDocOwner(doc.id, ownerId); return doc.id; }
    }
    const bgs = getBackgrounds({ onlyVisible: true });
    if (bgs.length) {
      const doc = await createFromBackground(bgs[0].id, "My Nest");
      if (ownerId) setDocOwner(doc.id, ownerId);
      return doc.id;
    }
    return undefined;
  }

  const placeInNest = useCallback(async () => {
    if (!chosen) return;
    setPlacing(true);
    try {
      if (savedId !== chosen.id) await inventory.save(assetFromGenerated(chosen, config.publishTargets[0]));
      const id = await ensureDraftId();
      // Open the editor on a REAL draft (so the placement persists on reopen), in the
      // Assets picker, with this new asset preselected (it leads the AI category).
      router.push(id ? `/nest-editor?document=${id}&pick=${chosen.id}` : `/nest-editor?pick=${chosen.id}`);
    } finally {
      setPlacing(false);
    }
    // ensureDraftId is a stable local helper; deps intentionally omit it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, savedId, ownerId, config, router]);

  const reset = useCallback(() => {
    setInput(null); setCandidates([]); setChosenId(null); setSavedId(null); setPhase("idle"); setError(null);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-parchment pb-24">
      <header className="sticky top-0 z-10 border-b border-timber/10 bg-parchment/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link href="/create" className="grid size-9 place-items-center rounded-full bg-white/70 shadow-soft">
            <ArrowLeft className="size-4 text-ink/70" />
          </Link>
          <div>
            <p className="eyebrow text-[#7a4fa0]">Turn your object into a Nestudio asset</p>
            <h1 className="display text-lg leading-none">Create with AI</h1>
          </div>
          <button
            onClick={() => setDevMode(!dev)}
            className={`ml-auto grid size-9 place-items-center rounded-full shadow-soft ${dev ? "bg-teal/15 text-teal" : "bg-white/70 text-ink/40"}`}
            title="Developer mode"
          >
            {dev ? <FlaskConical className="size-4" /> : <Sparkles className="size-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-4 pt-5">
        {/* upload */}
        <section>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void pickFile(f); }}
            className="group relative grid cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-timber/25 bg-white/50 p-8 text-center transition hover:border-[#7a4fa0]/50"
            style={input ? { background: CHECKER } : undefined}
          >
            {input ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={input.dataUrl} alt="your object" className="max-h-48 rounded-xl object-contain" />
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/45 text-white"
                  aria-label="Remove photo"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <div className="space-y-1">
                <Upload className="mx-auto size-7 text-ink/40" />
                <p className="text-sm font-bold text-ink/70">Take or upload a photo of your object</p>
                <p className="text-[11px] text-ink/45">Camera or library · JPG / PNG / WebP</p>
              </div>
            )}
          </div>
          {/* accept="image/*" lets iOS offer Camera + Photo Library (and HEIC). */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void pickFile(e.target.files[0])}
          />
          {input ? (
            <button onClick={() => fileRef.current?.click()} className="mt-2 w-full rounded-xl border border-timber/15 bg-white/70 px-3 py-2 text-xs font-bold text-ink/60">
              Replace photo
            </button>
          ) : null}
        </section>

        {/* subject + detail choice */}
        <section className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-ink/50">What is it?</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. my coffee mug"
              className="w-full rounded-xl border border-timber/15 bg-white/70 px-3 py-2.5 text-sm text-ink outline-none focus:border-[#7a4fa0]/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-ink/50">Before we translate it…</label>
            <div className="grid grid-cols-2 gap-2">
              <DetailPill active={detail === "preserve"} onClick={() => setDetail("preserve")} title="Preserve details" sub="Keep writing & marks" />
              <DetailPill active={detail === "simplify"} onClick={() => setDetail("simplify")} title="Simplify" sub="Remove writing" />
            </div>
          </div>
          <button
            onClick={onGenerate}
            disabled={!input || phase === "generating"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7a4fa0] px-4 py-3 text-sm font-black text-parchment shadow-lift transition active:scale-[0.99] disabled:opacity-40"
          >
            {phase === "generating" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {phase === "generating" ? `Creating ${progress}/${CANDIDATE_COUNT}…` : `Create ${CANDIDATE_COUNT} Nestudio versions`}
          </button>
        </section>

        {error ? <p className="rounded-xl bg-ember/10 px-3 py-2 text-sm font-bold text-ember">{error}</p> : null}

        {/* review — original + 3 candidates */}
        {candidates.length ? (
          <section className="space-y-3 rounded-3xl bg-white/70 p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-ink/70">{chosen ? "Your choice" : "Pick your favourite"}</p>
              <button onClick={onGenerate} disabled={phase === "generating"} className="inline-flex items-center gap-1 text-[12px] font-bold text-[#7a4fa0] disabled:opacity-40">
                <RefreshCw className="size-3.5" /> Regenerate all
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <Tile label="Your photo" bg="#fff" onClick={() => input && setZoom(input.dataUrl)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={input?.dataUrl} alt="your object" className="max-h-full max-w-full object-contain" />
              </Tile>
              {candidates.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => onChoose(c)}
                  className={`space-y-1 rounded-xl p-0.5 text-left ring-2 transition ${chosenId === c.id ? "ring-[#7a4fa0]" : "ring-transparent"}`}
                >
                  <div className="grid aspect-square place-items-center overflow-hidden rounded-lg p-1" style={{ background: NEST_TINT }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.png.dataUrl} alt={`candidate ${i + 1}`} className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="text-center text-[9px] font-bold uppercase tracking-wide text-ink/45">
                    {VARIANTS[i] ? `${VARIANTS[i].key} · ${VARIANTS[i].label}` : String.fromCharCode(65 + i)}{chosenId === c.id ? " ✓" : ""}
                  </p>
                </button>
              ))}
              {phase === "generating" ? Array.from({ length: CANDIDATE_COUNT - candidates.length }).map((_, i) => (
                <div key={`ph${i}`} className="grid aspect-square animate-pulse place-items-center rounded-lg bg-white/40" />
              )) : null}
            </div>

            {chosen ? (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  <PreviewCard label="Transparent" checker onClick={() => setZoom(chosen.png.dataUrl)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chosen.png.dataUrl} alt="transparent" className="max-h-full max-w-full object-contain" />
                  </PreviewCard>
                  <PreviewCard label="On a Nest" bg={NEST_TINT}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chosen.png.dataUrl} alt="on tint" className="max-h-full max-w-full object-contain" />
                  </PreviewCard>
                  <PreviewCard label="Enlarge" bg="#f3ecdf" onClick={() => setZoom(chosen.png.dataUrl)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chosen.png.dataUrl} alt="enlarge" className="max-h-full max-w-full object-contain" />
                  </PreviewCard>
                </div>

                <div>
                  <p className="display text-base leading-none">{chosen.metadata.name}</p>
                  <p className="text-[11px] text-ink/45">
                    {chosen.png.width}×{chosen.png.height} · transparent PNG ·{" "}
                    <span className={chosen.metadata.usedFallback ? "font-bold text-ember" : "font-bold text-teal"}>
                      {chosen.metadata.usedFallback ? `local fallback (from ${chosen.metadata.requestedProvider})` : chosen.metadata.provider}
                    </span>
                  </p>
                  {chosen.metadata.providerError ? (
                    <p className="mt-1 rounded bg-ember/10 px-2 py-1 text-[10px] font-bold text-ember">Hosted error: {chosen.metadata.providerError}</p>
                  ) : null}
                </div>

                <button
                  onClick={placeInNest}
                  disabled={placing}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7a4fa0] px-4 py-3 text-sm font-black text-parchment shadow-lift disabled:opacity-50"
                >
                  {placing ? <Loader2 className="size-4 animate-spin" /> : <Home className="size-4" />}
                  {placing ? "Opening your Nest…" : "Place in my Nest"}
                </button>
                <p className="text-center text-[11px] text-ink/45">Only your chosen version is saved — it appears in the editor’s AI category</p>
              </>
            ) : (
              <p className="text-center text-[12px] text-ink/45">Tap A, B or C to choose the one that feels most like your object.</p>
            )}

            {dev && chosen ? (
              <p className="font-mono text-[10px] text-ink/40">
                {chosen.metadata.provider} · {chosen.metadata.promptVersion} · q{chosen.metadata.quality ? Math.round(chosen.metadata.quality.score * 100) : "—"} · {chosen.metadata.refinePasses ?? 0} pass
              </p>
            ) : null}
          </section>
        ) : null}

        {/* inventory */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-black text-ink/70">Your objects</h2>
            <span className="text-[11px] text-ink/40">{history.length}</span>
          </div>
          {history.length ? (
            <div className="grid grid-cols-3 gap-2">
              {history.map((a) => (
                <div key={a.id} className="group relative overflow-hidden rounded-2xl bg-white/70 shadow-soft">
                  <div className="grid aspect-square place-items-center p-2" style={{ background: CHECKER }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt={a.name} className="max-h-full object-contain" />
                  </div>
                  <p className="truncate px-2 py-1 text-[10px] font-bold text-ink/60">{a.name}</p>
                  <button onClick={() => inventory.remove(a.id)} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100" aria-label="Delete">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-white/50 px-3 py-6 text-center text-[12px] text-ink/45">Your translated objects land here and in the editor’s AI category.</p>
          )}
        </section>
      </main>

      {/* zoom modal */}
      {zoom ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6" onClick={() => setZoom(null)}>
          <div className="grid max-h-[80vh] max-w-full place-items-center rounded-2xl p-4" style={{ background: CHECKER }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt="enlarged" className="max-h-[70vh] max-w-full object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailPill({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button onClick={onClick} className={`rounded-xl border px-3 py-2 text-left transition ${active ? "border-[#7a4fa0] bg-[#efe3f6]" : "border-timber/15 bg-white/70"}`}>
      <p className="text-xs font-black text-ink/75">{title}{active ? " ✓" : ""}</p>
      <p className="text-[10px] text-ink/45">{sub}</p>
    </button>
  );
}

function Tile({ label, children, bg, onClick }: { label: string; children: ReactNode; bg?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="space-y-1 text-left">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-lg p-1" style={{ background: bg }}>{children}</div>
      <p className="text-center text-[9px] font-bold uppercase tracking-wide text-ink/40">{label}</p>
    </button>
  );
}

function PreviewCard({ label, children, bg, checker, onClick }: { label: string; children: ReactNode; bg?: string; checker?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="space-y-1 text-left">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-xl p-1.5" style={{ background: checker ? CHECKER : bg }}>{children}</div>
      <p className="text-center text-[9px] font-bold uppercase tracking-wide text-ink/40">{label}</p>
    </button>
  );
}
