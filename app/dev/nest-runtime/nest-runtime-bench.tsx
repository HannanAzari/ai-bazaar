"use client";

import { NestRuntime } from "@/components/nest/app-shell/nest-runtime";
import { INTERACTIVE_TEST_NEST } from "@/lib/fixtures/interactive-nest";
import { resolveFocusRegions, resolvePlacementHotspots, resolvePlacementSurfaces } from "@/lib/nest-scene";

// ── M24E — the interaction bench ─────────────────────────────────────────────
//
// Editor Preview and the visitor view, side by side, on the SAME document. If a Focus
// opens on the left it must open identically on the right; if a Surface tap plays a video
// in one it must play in the other. Divergence is visible immediately rather than being
// discovered by a creator after publishing.
//
// It also prints what the resolvers extracted from the document, so "the region is not
// interactive" can be told apart from "the data never arrived" without a debugger — the
// exact ambiguity that made the Focus bug take three sprints to pin down.

export function NestRuntimeBench() {
  const focus = resolveFocusRegions(INTERACTIVE_TEST_NEST);
  const rows = INTERACTIVE_TEST_NEST.placements.map((p) => ({
    id: p.id,
    surfaces: resolvePlacementSurfaces(p).length,
    hotspots: resolvePlacementHotspots(p),
  }));

  return (
    <main className="min-h-screen bg-[#141414] p-4 text-white">
      <h1 className="text-lg font-black">Nest runtime · M24E</h1>
      <p className="mt-1 max-w-2xl text-xs text-white/60">
        One document, both modes. Tap the shelf to enter its Focus — the two books live only in the
        focused scene. Tap the TV screen to run the creator-bound YouTube action.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(["editor-preview", "visitor"] as const).map((mode) => (
          <section key={mode}>
            <h2 className="mb-1.5 text-[11px] font-black uppercase tracking-[.18em] text-white/50">{mode}</h2>
            <div data-mode={mode} className="overflow-hidden rounded-2xl border border-white/10" style={{ aspectRatio: "3 / 4", maxWidth: 420 }}>
              <NestRuntime document={INTERACTIVE_TEST_NEST} mode={mode} className="size-full" surround />
            </div>
          </section>
        ))}
      </div>

      <section className="mt-6 max-w-2xl text-xs">
        <h2 className="text-[11px] font-black uppercase tracking-[.18em] text-white/50">What the document resolved to</h2>
        <pre className="mt-1.5 overflow-x-auto rounded-xl bg-black/50 p-3 leading-relaxed text-white/75" data-resolved="">
{`focus regions : ${focus.length}`}
{focus.map((f) => `\n  ${f.area.id} → scene ${f.scene?.id ?? "(none)"} · ${f.objects.length} object(s) · crop ${JSON.stringify(f.crop)}`)}
{`\n\nplacements    : ${rows.length}`}
{rows.map((r) => `\n  ${r.id} · ${r.surfaces} surface(s) · ${r.hotspots.length} hotspot(s)${r.hotspots.map((h) => `\n      ${h.id} → ${h.interaction.type}${h.problem ? ` ⚠ ${h.problem}` : ""}`).join("")}`)}
        </pre>
      </section>
    </main>
  );
}
