"use client";

import { useState } from "react";
import { NestRuntime } from "@/components/nest/app-shell/nest-runtime";
import { INTERACTIVE_TEST_NEST, LEGACY_FOCUS_NEST } from "@/lib/fixtures/interactive-nest";
import { getBackgrounds } from "@/lib/nest-production-library";
import { capabilitiesForAsset, initialStateOf, isInteractiveObject, resolveConnection } from "@/lib/nest-asset-interaction";

// ── M25 — the interaction bench ──────────────────────────────────────────────
//
// Editor Preview and the visitor view, side by side, on the SAME document. Divergence is
// visible immediately rather than being discovered by a creator after publishing.
//
// It also prints what the resolvers extracted, so "this object is not interactive" can be
// told apart from "the data never arrived" without a debugger — the ambiguity that made
// the Focus bug take three sprints to pin down.

const BACKGROUNDS = ["bg-creator-loft", "bg-minimal-zen", "bg-gamer-cave"];

export function NestRuntimeBench() {
  const [bg, setBg] = useState(0);
  const [legacy, setLegacy] = useState(false);
  const available = getBackgrounds().map((b) => b.id);
  const bgId = BACKGROUNDS.filter((b) => available.includes(b))[bg] ?? INTERACTIVE_TEST_NEST.backgroundId;
  const base = legacy ? LEGACY_FOCUS_NEST : INTERACTIVE_TEST_NEST;
  const doc = { ...base, backgroundId: bgId };

  const rows = doc.placements.map((p) => ({
    id: p.id,
    caps: capabilitiesForAsset(p.assetId)?.capabilities.join("+") ?? "—",
    state: initialStateOf(p) ?? "—",
    conn: resolveConnection(p)?.kind ?? "—",
    tappable: isInteractiveObject(p),
  }));

  return (
    <main className="min-h-screen bg-[#141414] p-4 text-white">
      <h1 className="text-lg font-black">Nest runtime · M25 free zoom + object interaction</h1>
      <p className="mt-1 max-w-2xl text-xs text-white/60">
        Pinch (or ctrl+scroll) to zoom to 5×, drag to pan while zoomed, double-tap to toggle 2×.
        Tap the TV, the lamp, the desk or the tiny books on the shelf. The plant does nothing.
        There is no permanent icon on any object — use the ✨ Hint button.
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {BACKGROUNDS.map((b, i) => (
          <button key={b} onClick={() => setBg(i)} className={`rounded-full px-3 py-1 font-bold ${bg === i ? "bg-white text-black" : "bg-white/10"}`}>
            {b}
          </button>
        ))}
        <button onClick={() => setLegacy((v) => !v)} className={`rounded-full px-3 py-1 font-bold ${legacy ? "bg-amber-400 text-black" : "bg-white/10"}`}>
          {legacy ? "legacy Focus Nest" : "M25 Nest"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(["editor-preview", "visitor"] as const).map((mode) => (
          <section key={mode}>
            <h2 className="mb-1.5 text-[11px] font-black uppercase tracking-[.18em] text-white/50">{mode}</h2>
            <div data-mode={mode} className="overflow-hidden rounded-2xl border border-white/10" style={{ aspectRatio: "3 / 4", maxWidth: 420 }}>
              <NestRuntime document={doc} mode={mode} className="size-full" surround />
            </div>
          </section>
        ))}
      </div>

      <section className="mt-6 max-w-2xl text-xs">
        <h2 className="text-[11px] font-black uppercase tracking-[.18em] text-white/50">What the document resolved to</h2>
        <table className="mt-1.5 w-full rounded-xl bg-black/50 text-left font-mono text-[11px] text-white/75" data-resolved="">
          <thead className="text-white/40">
            <tr><th className="p-1.5">object</th><th>capabilities</th><th>initial</th><th>content</th><th>tappable</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-1.5">{r.id}</td><td>{r.caps}</td><td>{r.state}</td><td>{r.conn}</td>
                <td>{r.tappable ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
