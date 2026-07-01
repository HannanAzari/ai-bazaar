"use client";

import { useMemo } from "react";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import type { EditableNestDocument } from "@/lib/nest-editor-types";
import { projectChildObjectsToMain, type ProjectedChildObject } from "@/lib/nest-focus-projection";
import { resolveObjectSurfaces } from "@/lib/nest-surfaces";
import { SurfaceContentLayer } from "@/components/nest/surface-content-layer";

// ── Main-Nest projection of child Focus-Scene objects (M7C.8 Part B) ───────────
//
// A read-only VISUAL projection: native child objects drawn back in the Main Nest at the
// matching small position inside their Focus Area. One container per Focus Area, placed at
// `focusBounds` with `overflow: hidden` — so each child is positioned by its child-local
// box (which maps directly into the container) and is CLIPPED to the Focus Area, never
// spilling outside. No second object is persisted; this derives from the child scene.
//
// pointer-events: none — taps fall through to the Focus trigger (focus-first), so tapping a
// projected child enters its Focus Area rather than firing content directly.

const pct = (n: number) => `${+(n * 100).toFixed(3)}%`;

export function ProjectedFocusChildren({
  doc,
  assetsById,
  mode = "visitor",
  debug = false,
}: {
  doc: EditableNestDocument;
  assetsById: Record<string, LivingNestAsset>;
  mode?: "editor" | "visitor";
  debug?: boolean;
}) {
  const projections = useMemo(() => projectChildObjectsToMain(doc, { mode }), [doc, mode]);

  const areas = useMemo(() => {
    const map = new Map<string, { focus: ProjectedChildObject["focusBounds"]; items: ProjectedChildObject[] }>();
    for (const p of projections) {
      const entry = map.get(p.focusAreaId) ?? { focus: p.focusBounds, items: [] };
      entry.items.push(p);
      map.set(p.focusAreaId, entry);
    }
    return Array.from(map.entries());
  }, [projections]);

  if (areas.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden style={{ zIndex: 40 }}>
      {areas.map(([id, area]) => (
        <div
          key={id}
          className="absolute overflow-hidden"
          style={{
            left: pct(area.focus.x),
            top: pct(area.focus.y),
            width: pct(area.focus.width),
            height: pct(area.focus.height),
            outline: debug ? "1px dashed rgba(43,75,140,.55)" : undefined,
          }}
        >
          {area.items
            .slice()
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((o) => {
              const asset = assetsById[o.assetId];
              const floor = o.plane === "floor" || o.plane === "foreground";
              const t = `${o.rotation ? `rotate(${o.rotation}deg)` : ""}${o.flipX ? " scaleX(-1)" : ""}`.trim();
              return (
                <div
                  key={o.instanceId}
                  className="absolute"
                  style={{
                    left: pct(o.childBounds.x),
                    top: pct(o.childBounds.y),
                    width: pct(o.childBounds.width),
                    height: pct(o.childBounds.height),
                    transform: t || undefined,
                    transformOrigin: "center",
                    zIndex: o.zIndex,
                  }}
                >
                  {asset?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.imageUrl} alt="" draggable={false} className={`h-full w-full object-contain ${floor ? "object-bottom" : "object-center"}`} />
                  ) : null}
                  {/* M8: projected surfaces show the same personalization in Main. */}
                  <SurfaceContentLayer surfaces={resolveObjectSurfaces({ assetId: o.assetId, surfaces: o.surfaces })} />
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
