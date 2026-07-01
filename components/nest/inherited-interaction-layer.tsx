"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import type { InheritedFocusObject } from "@/lib/nest-focus-projection";

// ── Inherited parent interaction proxies inside a Focus Scene (M7C.8 Part A) ────
//
// Strategy A: the parent art is already in the flattened crop base — we draw NOTHING here,
// only ZERO-OPACITY interaction proxies (the inherited objects' boxes + their asset-local
// hotspots) aligned to the crop. Hotspots stay asset-local inside the mapped child box, so
// alignment is automatic through the focus transform.
//
//   • "preview"  (visitor)  — tapping an inherited hotspot opens its EFFECTIVE binding
//                             (child override beats parent). Self-contained little drawer.
//   • "connect"  (editor)   — inherited hotspots are softly outlined and selectable; the
//                             editor opens a binding sheet to author a child override.
//
// Inherited proxies sit BELOW native child objects (native child objects own overlaps).

const pct = (n: number) => `${+(n * 100).toFixed(3)}%`;

export function InheritedInteractionLayer({
  objects,
  mode,
  debug = false,
  selectedObjectId,
  selectedHotspotId,
  onSelect,
}: {
  objects: InheritedFocusObject[];
  mode: "preview" | "connect";
  debug?: boolean;
  /** Connect: the currently selected inherited object (derivedId). */
  selectedObjectId?: string;
  selectedHotspotId?: string;
  /** Connect: select an inherited object (+ optional hotspot) for binding authoring. */
  onSelect?: (derivedId: string, hotspotId?: string) => void;
}) {
  const [picked, setPicked] = useState<{ name: string; href?: string; label?: string } | null>(null);
  if (objects.length === 0) return null;

  return (
    // Container passes taps through; only precise inherited hotspots capture, so native
    // child objects below stay tappable everywhere else (M7C.8 layering rule).
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 45 }}>
      {objects.map((o) => {
        const t = `${o.rotation ? `rotate(${o.rotation}deg)` : ""}${o.flipX ? " scaleX(-1)" : ""}`.trim();
        const isSel = mode === "connect" && selectedObjectId === o.derivedId;
        return (
          <div
            key={o.derivedId}
            className={`absolute ${debug ? "outline outline-1 outline-dashed outline-cobalt/50" : ""} ${isSel ? "outline outline-2 outline-cobalt/70" : ""}`}
            style={{ left: pct(o.childBounds.x), top: pct(o.childBounds.y), width: pct(o.childBounds.width), height: pct(o.childBounds.height), transform: t || undefined, transformOrigin: "center" }}
          >
            {o.hotspots.map((h: NestAssetHotspot) => {
              if (mode === "connect" ? false : !h.enabled) return null;
              const ellipse = h.shape.type === "ellipse";
              const hsSel = isSel && selectedHotspotId === h.id;
              const visible = mode === "connect" || debug;
              return (
                <button
                  key={h.id}
                  type="button"
                  disabled={mode === "preview" && !h.enabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === "connect") onSelect?.(o.derivedId, h.id);
                    else setPicked({ name: h.name, href: h.binding?.url, label: h.binding?.label ?? h.semantic });
                  }}
                  aria-label={h.ariaLabel ?? h.name}
                  className={`pointer-events-auto absolute ${ellipse ? "rounded-full" : "rounded-[4px]"} ${
                    visible ? (hsSel ? "border-2 border-teal bg-teal/15" : "border border-dashed border-cobalt/55 bg-cobalt/[0.06]") : ""
                  }`}
                  style={{ left: pct(h.shape.x), top: pct(h.shape.y), width: pct(h.shape.width), height: pct(h.shape.height) }}
                >
                  {visible && (hsSel || debug) ? (
                    <span className="pointer-events-none absolute -top-4 left-0 whitespace-nowrap rounded bg-cobalt px-1 py-0.5 text-[8px] font-bold text-white">{h.name}</span>
                  ) : null}
                </button>
              );
            })}
            {/* Connect: an object with no hotspots is still selectable as a whole. */}
            {mode === "connect" && o.hotspots.length === 0 ? (
              <button type="button" aria-label={o.ariaLabel ?? "Inherited object"} onClick={(e) => { e.stopPropagation(); onSelect?.(o.derivedId); }} className="pointer-events-auto absolute inset-0 border border-dashed border-cobalt/40" />
            ) : null}
          </div>
        );
      })}

      {picked ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[90] p-2">
          <div className="rounded-2xl border border-ink/10 bg-parchment/95 p-3 shadow-lg backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="display truncate text-base leading-tight text-ink">{picked.name}</h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink/45">{picked.label}</p>
              </div>
              <button type="button" onClick={() => setPicked(null)} aria-label="Close" className="shrink-0 rounded-full p-1 text-ink/45 hover:bg-ink/5"><X className="h-4 w-4" /></button>
            </div>
            {picked.href ? (
              <a href={picked.href} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-parchment hover:bg-ink/85">Open ↗</a>
            ) : (
              <p className="mt-1 text-xs text-ink/45">A little piece of this home.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
