"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FlaskConical, Loader2, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import {
  generateAsset,
  STUDIO_CONFIGS,
  listPresets,
  type AssetKind,
  type GeneratedAsset,
  type ImageInput,
  type PipelineEvent,
} from "@/lib/ai";
import { inventory, assetFromGenerated } from "@/lib/ai-inventory";
import { useInventory } from "@/lib/ai-inventory/react";
import { useDevMode, setDevMode } from "@/lib/dev-mode";
import { SAMPLES } from "./samples";

// ── AI Creator Studio ────────────────────────────────────────────────────────
// Upload → AI transforms into Nestudio style → transparent asset → preview →
// approve → save → available in the editor. Minimal + premium; the AI output is
// the hero. Every action flows through lib/ai + lib/ai-inventory — this page never
// touches a provider or a prompt string. The kind switcher shows how Avatar /
// Background / House studios light up from the SAME screen once enabled.

const KINDS = Object.values(STUDIO_CONFIGS);
const CHECKER =
  "repeating-conic-gradient(#00000010 0% 25%, transparent 0% 50%) 50% / 20px 20px";

type Phase = "idle" | "generating" | "preview" | "error";

export function CreatorStudioClient() {
  const history = useInventory();
  const dev = useDevMode();
  const [kind, setKind] = useState<AssetKind>("furniture");
  const [subject, setSubject] = useState("");
  const [preset, setPreset] = useState("classic");
  const [input, setInput] = useState<ImageInput | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [generated, setGenerated] = useState<GeneratedAsset | null>(null);
  const [log, setLog] = useState<PipelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const config = STUDIO_CONFIGS[kind];
  const presets = listPresets();

  const pickFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setInput({ dataUrl: String(reader.result), fileName: file.name, mimeType: file.type });
      setGenerated(null);
      setPhase("idle");
      setSavedId(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const onGenerate = useCallback(async () => {
    if (!input) return;
    setPhase("generating");
    setError(null);
    setGenerated(null);
    setLog([]);
    try {
      const result = await generateAsset(kind, input, { subject, preset });
      setGenerated(result);
      setLog(result.log);
      setPhase("preview");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [input, kind, subject, preset]);

  const onApprove = useCallback(async () => {
    if (!generated) return;
    await inventory.save(assetFromGenerated(generated, config.publishTargets[0]));
    setSavedId(generated.id);
  }, [generated, config]);

  const reset = useCallback(() => {
    setInput(null);
    setGenerated(null);
    setPhase("idle");
    setError(null);
    setSavedId(null);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-parchment pb-24">
      {/* header */}
      <header className="sticky top-0 z-10 border-b border-timber/10 bg-parchment/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link href="/create" className="grid size-9 place-items-center rounded-full bg-white/70 shadow-soft">
            <ArrowLeft className="size-4 text-ink/70" />
          </Link>
          <div>
            <p className="eyebrow text-terracotta">Quality Engine</p>
            <h1 className="display text-lg leading-none">AI Creator Studio</h1>
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
        {/* kind switcher — proves the multi-studio architecture */}
        <div className="flex flex-wrap gap-2">
          {KINDS.map((c) => (
            <button
              key={c.kind}
              onClick={() => c.enabled && setKind(c.kind)}
              disabled={!c.enabled}
              className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-soft transition ${
                kind === c.kind ? "bg-terracotta text-parchment" : c.enabled ? "bg-white/80 text-ink/70" : "cursor-not-allowed bg-white/50 text-ink/30"
              }`}
              title={c.enabled ? c.label : `${c.label} — coming soon (same engine)`}
            >
              {c.label}
              {!c.enabled ? " · soon" : ""}
            </button>
          ))}
        </div>

        {/* style preset — Nestudio Classic enabled; others prove the architecture */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-ink/45">Style:</span>
          {presets.map((pr) => (
            <button
              key={pr.id}
              onClick={() => pr.enabled && setPreset(pr.id)}
              disabled={!pr.enabled}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold shadow-soft transition ${
                preset === pr.id ? "bg-teal text-parchment" : pr.enabled ? "bg-white/80 text-ink/60" : "cursor-not-allowed bg-white/50 text-ink/30"
              }`}
            >
              {pr.label.replace("Nestudio ", "")}{!pr.enabled ? " · soon" : ""}
            </button>
          ))}
        </div>

        {/* upload area */}
        <section>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) pickFile(f);
            }}
            className="group grid cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-timber/25 bg-white/50 p-8 text-center transition hover:border-terracotta/50"
            style={input ? { background: CHECKER } : undefined}
          >
            {input ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={input.dataUrl} alt="source" className="max-h-40 rounded-xl object-contain" />
            ) : (
              <div className="space-y-1">
                <Upload className="mx-auto size-7 text-ink/40" />
                <p className="text-sm font-bold text-ink/70">Upload a photo of your object</p>
                <p className="text-[11px] text-ink/45">PNG / JPG / WebP · tap or drop</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
          />

          {/* samples */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] font-bold text-ink/45">Try a sample:</span>
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                onClick={() => { setInput(s.input); setSubject(s.subject); setGenerated(null); setPhase("idle"); setSavedId(null); }}
                className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-ink/60 shadow-soft"
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* subject + generate */}
        <section className="space-y-2">
          <label className="block text-[11px] font-bold text-ink/50">What is it?</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={config.defaultSubject}
            className="w-full rounded-xl border border-timber/15 bg-white/70 px-3 py-2.5 text-sm text-ink outline-none focus:border-terracotta/50"
          />
          <button
            onClick={onGenerate}
            disabled={!input || phase === "generating"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-sm font-black text-parchment shadow-lift transition active:scale-[0.99] disabled:opacity-40"
          >
            {phase === "generating" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {phase === "generating" ? "Generating…" : "Generate Nestudio asset"}
          </button>
        </section>

        {/* pipeline log */}
        {log.length ? (
          <section className="rounded-2xl bg-white/60 p-3">
            <p className="mb-1.5 text-[11px] font-bold text-ink/50">Pipeline</p>
            <div className="flex flex-wrap gap-1.5">
              {log.filter((e) => e.status === "done" || e.status === "skip").map((e, i) => (
                <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${e.status === "skip" ? "bg-ink/5 text-ink/35" : "bg-meadow-shade/15 text-meadow-shade"}`}>
                  {e.stage}{e.status === "skip" ? " (skipped)" : e.ms != null ? ` ${e.ms}ms` : ""}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {error ? <p className="rounded-xl bg-ember/10 px-3 py-2 text-sm font-bold text-ember">{error}</p> : null}

        {/* comparison + quality — the AI output is the hero */}
        {generated ? (
          <section className="space-y-3 rounded-3xl bg-white/70 p-4 shadow-soft">
            {/* Original → Generated → Transparency → Final Asset */}
            <div className="grid grid-cols-4 gap-1.5">
              <CompareTile label="Original" bg="#fff">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={input?.dataUrl} alt="original" className="max-h-full max-w-full object-contain" />
              </CompareTile>
              <CompareTile label="Generated" bg="#f3ecdf">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={generated.png.dataUrl} alt="generated" className="max-h-full max-w-full object-contain" />
              </CompareTile>
              <CompareTile label="Alpha" checker>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={generated.png.dataUrl} alt="transparency" className="max-h-full max-w-full object-contain" />
              </CompareTile>
              <CompareTile label="In room" bg="#e7d8bd">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={generated.png.dataUrl} alt="final" className="max-h-full max-w-full object-contain" />
              </CompareTile>
            </div>

            {/* quality + insights */}
            <QualityRow generated={generated} dev={dev} />

            <div className="flex items-center justify-between">
              <div>
                <p className="display text-base leading-none">{generated.metadata.name}</p>
                <p className="text-[11px] text-ink/45">
                  {generated.png.width}×{generated.png.height} · transparent PNG · {generated.metadata.provider}
                </p>
              </div>
              {savedId === generated.id ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-meadow-shade/15 px-3 py-1.5 text-xs font-bold text-meadow-shade">
                  <Check className="size-3.5" /> Saved to inventory
                </span>
              ) : null}
            </div>
            {savedId === generated.id ? (
              <div className="flex gap-2">
                <Link href="/nest-editor" className="flex-1 rounded-xl bg-terracotta px-4 py-2.5 text-center text-sm font-black text-parchment">Open editor</Link>
                <button onClick={reset} className="rounded-xl border border-timber/20 bg-white px-4 py-2.5 text-sm font-bold text-ink/60">New</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={onApprove} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-meadow-shade px-4 py-2.5 text-sm font-black text-parchment">
                  <Check className="size-4" /> Approve &amp; Save
                </button>
                <button onClick={reset} className="rounded-xl border border-timber/20 bg-white px-4 py-2.5 text-sm font-bold text-ink/60">Discard</button>
              </div>
            )}
          </section>
        ) : null}

        {/* history / inventory */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-black text-ink/70">Your inventory</h2>
            <span className="text-[11px] text-ink/40">{history.length} asset{history.length === 1 ? "" : "s"}</span>
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
                  <button
                    onClick={() => inventory.remove(a.id)}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-white/50 px-3 py-6 text-center text-[12px] text-ink/45">
              Approved assets land here and appear in the editor&apos;s asset picker.
            </p>
          )}
        </section>

        {/* dev-only: the review panel (future Admin Asset Factory) */}
        {dev ? (
          <Link href="/creator-studio/review" className="flex items-center justify-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-4 py-2.5 text-sm font-bold text-teal">
            <FlaskConical className="size-4" /> Open Asset Review panel
          </Link>
        ) : null}
      </main>
    </div>
  );
}

function CompareTile({ label, children, bg, checker }: { label: string; children: ReactNode; bg?: string; checker?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-xl p-1.5" style={{ background: checker ? CHECKER : bg }}>
        {children}
      </div>
      <p className="text-center text-[9px] font-bold uppercase tracking-wide text-ink/40">{label}</p>
    </div>
  );
}

function QualityRow({ generated, dev }: { generated: GeneratedAsset; dev: boolean }) {
  const q = generated.metadata.quality;
  const insights = (generated.metadata.insights ?? {}) as { material?: string; recommendedRoom?: string; colors?: string[]; surfaceType?: string; scaleHint?: string };
  const score = q ? Math.round(q.score * 100) : 0;
  const tone = score >= 85 ? "text-meadow-shade bg-meadow-shade/15" : score >= 60 ? "text-saffron bg-saffron/15" : "text-ember bg-ember/15";
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tone}`}>Quality {score}%{q?.ok ? " ✓" : ""}</span>
        {insights.material ? <Chip>{insights.material}</Chip> : null}
        {insights.recommendedRoom ? <Chip>{insights.recommendedRoom}</Chip> : null}
        {insights.surfaceType ? <Chip>{insights.surfaceType}</Chip> : null}
        {(insights.colors ?? []).slice(0, 3).map((c) => (
          <span key={c} className="size-4 rounded-full ring-1 ring-black/10" style={{ background: c }} title={c} />
        ))}
      </div>
      {dev ? (
        <p className="font-mono text-[10px] text-ink/45">
          {generated.metadata.promptVersion} · preset:{generated.metadata.preset} · {generated.metadata.refinePasses ?? 0} refine pass{(generated.metadata.refinePasses ?? 0) === 1 ? "" : "es"}
          {q && q.issues.length ? ` · ${q.issues.map((i) => i.code).join(", ")}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-ink/55">{children}</span>;
}
