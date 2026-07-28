"use client";

import { NestPreview } from "@/components/nest/app-shell/nest-preview";
import { CANONICAL_TEST_NEST } from "@/lib/fixtures/canonical-nest";

// M23A — visual parity bench. The SAME canonical fixture rendered at every surface's size.
// Because all of them go through `lib/nest-geometry`, the relative composition must be
// identical — only the viewport differs. Any divergence here is a real regression.
const SURFACES = [
  { label: "Profile card", w: 160, ratio: "4/5" },
  { label: "Search thumb", w: 110, ratio: "4/5" },
  { label: "Home feed", w: 300, ratio: "3/4" },
  { label: "Full Nest", w: 360, ratio: "3/4" },
];

export function NestParityClient() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl bg-parchment px-4 py-6 text-ink">
      <h1 className="display text-2xl">Nest parity</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        One canonical Nest — large · small · rotated · flipped · overlapping (z-order) · text overlay ·
        image overlay — rendered at every surface size through the shared geometry
        (<code className="text-xs">lib/nest-geometry</code>). The composition must look identical;
        only the viewport changes.
      </p>

      <div className="mt-6 flex flex-wrap items-start gap-6">
        {SURFACES.map((s) => (
          <figure key={s.label} className="shrink-0">
            <div
              className="overflow-hidden rounded-2xl border border-timber/20 shadow-soft"
              style={{ width: s.w, aspectRatio: s.ratio }}
            >
              <NestPreview doc={CANONICAL_TEST_NEST} className="h-full w-full" />
            </div>
            <figcaption className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-ink/45">
              {s.label} · {s.w}px
            </figcaption>
          </figure>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-black text-ink">Expected in every panel</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink/70">
        <li>the wide sofa low-left and the small table right of it, feet on the floor</li>
        <li>one table rotated ~18°</li>
        <li>the tall shelf mirrored (flipX)</li>
        <li>the small table painting <em>over</em> the TV (z-order)</li>
        <li><b>“Welcome home” text overlay</b> top-left — previously invisible outside the editor</li>
        <li><b>image overlay</b> top-right, rotated −8° — previously invisible outside the editor</li>
      </ul>
    </div>
  );
}
