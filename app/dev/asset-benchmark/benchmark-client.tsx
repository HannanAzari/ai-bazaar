"use client";
/* eslint-disable @next/next/no-img-element -- internal dev tool; data-URL previews, not user-facing LCP */

/**
 * Asset Benchmark Studio (M32, internal) — the tool that answers "which provider
 * best satisfies the Nestudio Asset DNA?" objectively.
 *
 * One source image → one cutout → the SAME cutout + DNA handed to every provider →
 * results side by side → scored against the DNA scorecard (the HUMAN judges). We do
 * NOT judge by prompts; the prompt is identical for all (assembled from the DNA).
 * Unavailable providers (no key) are shown honestly, never faked.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import type { RasterImage } from "@/lib/ai/types";
import { autoCutout } from "@/lib/cutout";
import { BENCHMARK_DIMENSIONS, BENCHMARK_MAX_SCORE, ASSET_DNA_VERSION } from "@/lib/asset-dna";
import {
  generateAsset,
  listAssetProviders,
  fetchAvailability,
  ACTIVE_ASSET_PROVIDER,
  type AssetCandidate,
} from "@/lib/asset-pipeline";

type ProviderRun = {
  id: string;
  label: string;
  note?: string;
  available: boolean;
  loading: boolean;
  candidate?: AssetCandidate;
  error?: string;
  scores: Record<string, number>; // dimension key → 0|1|2
};

export function BenchmarkClient() {
  const providers = useMemo(() => listAssetProviders(), []);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [source, setSource] = useState<string | null>(null);
  const [cutout, setCutout] = useState<RasterImage | null>(null);
  const [subject, setSubject] = useState("coffee mug");
  const [runs, setRuns] = useState<ProviderRun[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchAvailability().then(setAvailability);
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setSource(dataUrl);
    setCutout(null);
    const { cutout: c } = await autoCutout(dataUrl);
    setCutout(c);
  };

  const runAll = async () => {
    if (!cutout) return;
    setBusy(true);
    const base: ProviderRun[] = providers.map((p) => ({
      id: p.id,
      label: p.label,
      note: p.note,
      available: availability[p.id] === true,
      loading: availability[p.id] === true,
      scores: {},
    }));
    setRuns(base);

    // Run every AVAILABLE provider through the identical path, no fallback (judge honestly).
    await Promise.all(
      base.map(async (run, i) => {
        if (!run.available) return;
        try {
          const res = await generateAsset({ cutout, subject: subject.trim() || "object", variants: 1 }, { provider: run.id, allowFallback: false });
          setRuns((prev) => {
            const next = prev.slice();
            next[i] = { ...next[i], loading: false, candidate: res.candidates[0], error: res.candidates.length ? undefined : res.error ?? "no candidate" };
            return next;
          });
        } catch (e) {
          setRuns((prev) => {
            const next = prev.slice();
            next[i] = { ...next[i], loading: false, error: (e as Error).message };
            return next;
          });
        }
      }),
    );
    setBusy(false);
  };

  const setScore = (providerId: string, dim: string, val: number) => {
    setRuns((prev) => prev.map((r) => (r.id === providerId ? { ...r, scores: { ...r.scores, [dim]: val } } : r)));
  };
  const totalFor = (r: ProviderRun) => BENCHMARK_DIMENSIONS.reduce((s, d) => s + (r.scores[d.key] ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl p-4 text-ink">
      <header className="mb-4">
        <h1 className="text-lg font-black tracking-tight">Asset Benchmark Studio <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">internal</span></h1>
        <p className="text-xs text-ink/55">One source · one cutout · every provider · scored against {ASSET_DNA_VERSION}. Active provider: <b>{ACTIVE_ASSET_PROVIDER}</b>. Judge by consistency, not prompts.</p>
      </header>

      {/* Source + cutout */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ink/12 bg-white/70 p-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-2 text-xs font-bold text-parchment"><Upload className="h-4 w-4" /> Source image</button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        <label className="text-xs font-bold text-ink/60">Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-sm" />
        {source ? <img src={source} alt="source" className="h-14 w-14 rounded object-cover" /> : null}
        {cutout ? <img src={cutout.dataUrl} alt="cutout" className="checker h-14 w-14 rounded object-contain" /> : null}
        <button type="button" onClick={runAll} disabled={!cutout || busy} className="ml-auto inline-flex items-center gap-2 rounded-full bg-cobalt px-4 py-2 text-xs font-black text-white disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Run all providers
        </button>
      </div>

      {/* Provider columns */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(runs.length ? runs : providers.map((p) => ({ id: p.id, label: p.label, note: p.note, available: availability[p.id] === true, loading: false, scores: {} as Record<string, number> }))).map((r) => (
          <div key={r.id} className={`rounded-xl border p-3 ${r.available ? "border-ink/15 bg-white/80" : "border-ink/10 bg-ink/5 opacity-70"}`}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-black">{r.label}</p>
                <p className="text-[10px] text-ink/45">{r.note}{r.available ? "" : " · no key"}</p>
              </div>
              {runs.length ? <span className="rounded-full bg-cobalt/12 px-2 py-0.5 text-xs font-black text-cobalt">{totalFor(r as ProviderRun)}/{BENCHMARK_MAX_SCORE}</span> : null}
            </div>

            <div className="checker mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-ink/10">
              {("loading" in r && r.loading) ? <Loader2 className="h-6 w-6 animate-spin text-cobalt" />
                : ("candidate" in r && r.candidate) ? <img src={r.candidate.image.dataUrl} alt={r.label} className="h-full w-full object-contain p-1" />
                : ("error" in r && r.error) ? <p className="p-2 text-center text-[10px] text-rust">{r.error}</p>
                : <p className="text-[10px] text-ink/35">{r.available ? "not run" : "unavailable"}</p>}
            </div>

            {/* Scorecard — human judges */}
            {runs.length && "candidate" in r && r.candidate ? (
              <div className="space-y-1">
                {BENCHMARK_DIMENSIONS.map((d) => (
                  <div key={d.key} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-ink/60" title={d.test}>{d.label}</span>
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((v) => (
                        <button key={v} type="button" onClick={() => setScore(r.id, d.key, v)} className={`h-5 w-5 rounded text-[10px] font-bold ${(r as ProviderRun).scores[d.key] === v ? "bg-cobalt text-white" : "bg-ink/8 text-ink/50"}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <style>{`.checker{background-image:linear-gradient(45deg,#0000000d 25%,transparent 25%,transparent 75%,#0000000d 75%),linear-gradient(45deg,#0000000d 25%,transparent 25%,transparent 75%,#0000000d 75%);background-size:14px 14px;background-position:0 0,7px 7px;background-color:#fff}`}</style>
    </div>
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
