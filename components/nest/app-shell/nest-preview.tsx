"use client";

import { useState } from "react";
import { resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import { OverlayContent } from "@/components/nest/overlay-content";
import { inPaintOrder, placementStyle } from "@/lib/nest-geometry";
import type { NestDocument } from "@/lib/nest-document-types";

// M17.1 — a composed Nest: the real room with the creator's actual placed assets, at any size.
// Shared by Profile cards, discovery cards, the feed and the full visitor view.
//
// M23A — this component no longer invents its own layout. Geometry comes from
// `lib/nest-geometry.placementStyle`, the SAME function the editor canvas uses, so a Nest is
// identical in the editor, on a Profile card, in the feed, in search and at full screen.
// It previously computed `width = scale * 55%` (vs the editor's `scale * 0.5`), ignored
// height, dropped every text/image overlay, and lost mirroring.
//
// Beta Polish 1: an optional `safe` inset. When set, the whole room stage (background +
// objects together, so nothing detaches from the floor) is confined to a band, leaving the
// top/bottom as reserved UI zones. `overflow-hidden` clips anything that would spill.
export function NestPreview({
  doc,
  className = "",
  rounded = "",
  safe,
}: {
  doc: NestDocument;
  className?: string;
  rounded?: string;
  /** Reserve top/bottom bands (fractions of height) that objects must stay clear of. */
  safe?: { top?: number; bottom?: number };
}) {
  const background = resolveBackground(doc.backgroundId);
  const [loaded, setLoaded] = useState(false);
  const stageStyle: React.CSSProperties = safe
    ? { top: `${(safe.top ?? 0) * 100}%`, bottom: `${(safe.bottom ?? 0) * 100}%`, left: 0, right: 0 }
    : { inset: 0 };

  return (
    // M23B §8 — `isolate` is load-bearing, not decoration.
    //
    // Each placement carries an inline `zIndex` (1…n) from placementStyle. This root was
    // `relative` with z-index:auto, so it did NOT form a stacking context and those
    // z-indexes leaked into whatever ancestor did — the feed card. A sofa with zIndex 3
    // therefore competed with, and painted OVER, the creator row and Nest title rendered
    // as later siblings. That is the "furniture covering metadata" bug in the founder's
    // screenshots.
    //
    // `isolation: isolate` contains the room's internal paint order inside the room,
    // where it belongs. Fixing it here fixes every surface at once — feed, Profile card,
    // search thumbnail and the full Nest view — instead of patching each one.
    <div className={`relative isolate overflow-hidden bg-[#e9e0c8] ${rounded} ${className}`}>
      {/* soft shimmer until the room's background paints in — no blank pop */}
      {background && !loaded ? <div className="nest-shimmer absolute inset-0" /> : null}
      <div className="absolute overflow-hidden" style={stageStyle}>
        {background ? (
          // eslint-disable-next-line @next/next/no-img-element -- local curated art; next/image adds no value here
          <img
            src={background.variants.standard ?? background.imageUrl}
            alt={background.name}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>
        )}

        {inPaintOrder(doc.placements).map((p, i) => {
          const style = placementStyle(p, i);

          // Overlays (text / image stickers) are creator content, not catalog assets. They
          // used to be dropped here because `resolveAsset("overlay:text")` is undefined —
          // which is why stickers were invisible everywhere except the editor.
          if (p.overlay) {
            return (
              <div key={p.id} className="absolute" style={style}>
                <OverlayContent overlay={p.overlay} />
              </div>
            );
          }

          const asset = resolveAsset(p.assetId); // resolves archived assets too → cards never break
          if (!asset) return null;
          return (
            <div key={p.id} className="absolute" style={style}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local curated art */}
              <img
                src={asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl}
                alt={asset.name}
                className="h-full w-full object-contain drop-shadow"
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
