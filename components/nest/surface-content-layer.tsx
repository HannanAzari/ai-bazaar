"use client";

import type { EditableSurface, SurfaceContent } from "@/lib/nest-surface-types";

// ── Editable-surface content renderer (M8, Phase 6) ─────────────────────────
//
// Draws each surface's content CLIPPED to its asset-local bounds (0..1 of the object box).
// Because it is positioned in % inside the object's transformed box, the content scales /
// rotates / flips with the object automatically (move, resize, rotate, focus projection,
// zoom scenes) and never overflows the asset (overflow:hidden). Purely visual — no pointer
// events, no interaction. Text/sticker scale with the surface via container-query units.

const pct = (n: number) => `${+(n * 100).toFixed(3)}%`;

const TEXT_VARIANT: Record<string, { className: string; sizeCq: number }> = {
  title: { className: "font-black uppercase tracking-tight", sizeCq: 20 },
  quote: { className: "font-semibold italic", sizeCq: 15 },
  goal: { className: "font-bold", sizeCq: 16 },
  slogan: { className: "font-black uppercase", sizeCq: 18 },
  note: { className: "font-medium", sizeCq: 15 },
};

function Content({ surface }: { surface: EditableSurface }) {
  const c = surface.content as SurfaceContent;
  if (c.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={c.src} alt="" draggable={false} className="h-full w-full" style={{ objectFit: c.fit ?? "cover" }} />;
  }
  if (c.kind === "sticker") {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ containerType: "size" }}>
        <span style={{ fontSize: "62cqmin", lineHeight: 1 }}>{c.emoji}</span>
      </div>
    );
  }
  // text
  const v = TEXT_VARIANT[c.variant ?? "note"] ?? TEXT_VARIANT.note;
  return (
    <div className="flex h-full w-full items-center justify-center bg-parchment/92 p-[7%] text-center text-ink" style={{ containerType: "size" }}>
      <span className={v.className} style={{ fontSize: `${v.sizeCq}cqmin`, lineHeight: 1.15, overflowWrap: "anywhere" }}>{c.text}</span>
    </div>
  );
}

export function SurfaceContentLayer({ surfaces, debug = false }: { surfaces: EditableSurface[]; debug?: boolean }) {
  const drawn = surfaces.filter((s) => s.content || debug);
  if (drawn.length === 0) return null;
  return (
    <>
      {drawn.map((s) => (
        <div
          key={s.id}
          aria-hidden
          className="pointer-events-none absolute overflow-hidden"
          style={{
            left: pct(s.bounds.x),
            top: pct(s.bounds.y),
            width: pct(s.bounds.width),
            height: pct(s.bounds.height),
            borderRadius: s.cornerRadiusPx ?? 0,
            outline: debug && !s.content ? "1px dashed rgba(43,75,140,.6)" : undefined,
          }}
        >
          {s.content ? <Content surface={s} /> : null}
        </div>
      ))}
    </>
  );
}
