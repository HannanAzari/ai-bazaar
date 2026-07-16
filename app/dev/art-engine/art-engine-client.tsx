"use client";
/* eslint-disable @next/next/no-img-element -- internal dev tool; data-URL/local previews */

/**
 * Art Engine lab (M33, internal) — proves the Definition of Done machinery:
 *  · the MEASURED official DNA (fingerprint) + each official asset scored (calibration:
 *    officials must score high — the validator agrees they "belong"),
 *  · the FAMILY TEST — a generated asset placed beside the official sofa/bookshelf/
 *    lamp/table/plant,
 *  · the 9 BENCHMARK objects, each scored by the Style Validator gate.
 *
 * Judge by the validator + your eyes. No generation prompts are touched here.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import type { RasterImage } from "@/lib/ai/types";
import { autoCutout } from "@/lib/cutout";
import { generateAsset, type AssetCandidate } from "@/lib/asset-pipeline";
import {
  getOfficialProfile,
  getOfficialFingerprints,
  FAMILY_ANCHOR_URLS,
} from "@/lib/art-engine/official";
import { validateStyle, type StyleReport } from "@/lib/art-engine/validator";
import { fingerprintOf } from "@/lib/art-engine/conform";
import type { StyleProfile } from "@/lib/art-engine/fingerprint";

const BENCHMARK_OBJECTS = ["coffee mug", "book", "plant", "headphones", "keyboard", "camera", "chair", "watch", "backpack"];

type Made = { subject: string; image: RasterImage; report: StyleReport };

export function ArtEngineClient() {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [officials, setOfficials] = useState<{ url: string; report: StyleReport }[]>([]);
  const [subject, setSubject] = useState("coffee mug");
  const [made, setMade] = useState<Made | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const prof = await getOfficialProfile();
      setProfile(prof);
      const fps = await getOfficialFingerprints();
      setOfficials(fps.map(({ url, fingerprint }) => ({ url, report: validateStyle(fingerprint, prof) })));
    })();
  }, []);
  const reference = profile?.mean ?? null;

  const officialAvg = useMemo(
    () => (officials.length ? officials.reduce((s, o) => s + o.report.score, 0) / officials.length : 0),
    [officials],
  );

  const onFile = async (file: File | undefined) => {
    if (!file || !profile) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { cutout } = await autoCutout(dataUrl);
      const res = await generateAsset({ cutout, subject: subject.trim() || "object", variants: 1 }, { allowFallback: true });
      const cand: AssetCandidate | undefined = res.candidates[0];
      if (!cand) { setError(res.error ?? "no candidate"); setBusy(false); return; }
      const report = res.report ?? validateStyle(await fingerprintOf(cand.image), profile);
      setMade({ subject: subject.trim() || "object", image: cand.image, report });
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-5xl p-4 text-ink">
      <header className="mb-4">
        <h1 className="text-lg font-black tracking-tight">Nestudio Art Engine <span className="rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">internal</span></h1>
        <p className="text-xs text-ink/55">Measured official DNA · Style Validator gate · Family test · Benchmark objects. Goal: one artistic language.</p>
      </header>

      {/* Measured DNA + calibration */}
      <section className="mb-5 rounded-xl border border-ink/12 bg-white/70 p-3">
        <h2 className="mb-2 text-sm font-black">Official DNA (measured) · calibration</h2>
        {reference ? (
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink/70">
            <span>saturation {reference.saturation.toFixed(2)}</span>
            <span>warmth {reference.warmth.toFixed(2)}</span>
            <span>value {reference.value.toFixed(2)}</span>
            <span>matte {reference.matteness.toFixed(2)}</span>
            <span>soft {reference.edgeSoftness.toFixed(2)}</span>
            <span>coverage {reference.coverage.toFixed(2)}</span>
            <span>purity {reference.purity.toFixed(2)}</span>
            <span className="font-bold text-cobalt">officials avg score {(officialAvg * 100).toFixed(0)}%</span>
          </div>
        ) : <Loader2 className="h-4 w-4 animate-spin text-cobalt" />}
        <div className="flex flex-wrap gap-2">
          {officials.map((o) => (
            <div key={o.url} className="paper-tile flex w-20 flex-col items-center rounded-lg border border-ink/10 p-1">
              <img src={o.url} alt="" className="h-14 w-full object-contain" />
              <span className={`mt-0.5 text-[10px] font-bold ${o.report.pass ? "text-emerald-600" : "text-rust"}`}>{(o.report.score * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* Test a generation */}
      <section className="mb-5 rounded-xl border border-ink/12 bg-white/70 p-3">
        <h2 className="mb-2 text-sm font-black">Test — generate &amp; gate</h2>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-ink/60">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-sm" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={!reference || busy} className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-2 text-xs font-bold text-parchment disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Source photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          {error ? <span className="text-xs font-semibold text-rust">{error}</span> : null}
        </div>

        {/* Family test: generated beside the family anchors */}
        <div className="shelf flex items-end gap-2 overflow-x-auto rounded-xl p-3">
          {made ? (
            <div className="flex shrink-0 flex-col items-center">
              <img src={made.image.dataUrl} alt={made.subject} className="h-24 object-contain drop-shadow-[0_8px_14px_rgba(56,41,29,0.28)]" />
              <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-black ${made.report.pass ? "bg-emerald-500/15 text-emerald-700" : "bg-rust/15 text-rust"}`}>
                {made.report.pass ? "belongs" : "off-family"} · {(made.report.score * 100).toFixed(0)}%
              </span>
            </div>
          ) : <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-ink/25 text-[10px] text-ink/40">generated</div>}
          <div className="mx-1 h-24 w-px shrink-0 bg-ink/15" />
          {FAMILY_ANCHOR_URLS.map((u) => (
            <img key={u} src={u} alt="" className="h-24 shrink-0 object-contain drop-shadow-[0_8px_14px_rgba(56,41,29,0.22)]" />
          ))}
        </div>

        {/* Validator dimensions for the generated asset */}
        {made ? (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            {made.report.dims.map((d) => (
              <div key={d.key} className="flex items-center justify-between text-[11px]">
                <span className="text-ink/60">{d.label}</span>
                <span className={`font-bold ${d.score < 0.5 ? "text-rust" : d.score < 0.75 ? "text-amber-600" : "text-emerald-600"}`}>{(d.score * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Benchmark checklist */}
      <section className="rounded-xl border border-ink/12 bg-white/70 p-3">
        <h2 className="mb-2 text-sm font-black">Benchmark objects</h2>
        <p className="mb-2 text-[11px] text-ink/50">Definition of Done: none of these should obviously read as AI. Pick a subject above and drop a source photo to score each.</p>
        <div className="flex flex-wrap gap-1.5">
          {BENCHMARK_OBJECTS.map((o) => (
            <button key={o} type="button" onClick={() => setSubject(o)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${subject === o ? "border-cobalt bg-cobalt/12 text-cobalt" : "border-ink/15 text-ink/60"}`}>{o}</button>
          ))}
        </div>
      </section>

      <style>{`
        .paper-tile{background:radial-gradient(120% 120% at 30% 20%,#fffdf8,#f2e9d8)}
        .shelf{background:linear-gradient(180deg,#f6efe1,#ecdfc8);box-shadow:inset 0 -6px 12px -6px rgba(56,41,29,0.25)}
      `}</style>
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
