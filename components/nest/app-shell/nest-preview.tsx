"use client";

import { resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import type { NestDocument } from "@/lib/nest-document-types";

// M17.1 — a composed Nest thumbnail: the real room, with the creator's actual placed
// furniture/assets, at any size. Shared by discovery cards, the feed, and profile cards
// so a Nest card shows what the creator MADE — not just an empty shell.
//
// Beta Polish 1: an optional `safe` inset. When set, the whole room stage (background +
// furniture together, so nothing detaches from the floor) is confined to a band, leaving
// the top/bottom as reserved UI zones — furniture can never sit under the identity header
// or the action buttons. `overflow-hidden` on the stage clips anything that would spill.
export function NestPreview({
  doc,
  className = "",
  rounded = "",
  safe,
}: {
  doc: NestDocument;
  className?: string;
  rounded?: string;
  /** Reserve top/bottom bands (fractions of height) that furniture must stay clear of. */
  safe?: { top?: number; bottom?: number };
}) {
  const background = resolveBackground(doc.backgroundId);
  const stageStyle: React.CSSProperties = safe
    ? { top: `${(safe.top ?? 0) * 100}%`, bottom: `${(safe.bottom ?? 0) * 100}%`, left: 0, right: 0 }
    : { inset: 0 };

  return (
    <div className={`relative overflow-hidden bg-[#e9e0c8] ${rounded} ${className}`}>
      <div className="absolute overflow-hidden" style={stageStyle}>
        {background ? (
          // eslint-disable-next-line @next/next/no-img-element -- local curated art; next/image adds no value here
          <img src={background.variants.standard ?? background.imageUrl} alt={background.name} className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>
        )}
        {doc.placements
          .slice()
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
          .map((p) => {
            const asset = resolveAsset(p.assetId); // resolves even archived assets → cards never break
            if (!asset) return null;
            const widthPct = Math.max(8, Math.min(60, (p.scale ?? 0.4) * 55));
            return (
              <div
                key={p.id}
                className="absolute"
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${widthPct}%`, transform: `translate(-50%, -100%) rotate(${p.rotation ?? 0}deg)`, zIndex: p.zIndex ?? 1 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local curated art */}
                <img src={asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl} alt={asset.name} className="w-full object-contain drop-shadow" loading="lazy" />
              </div>
            );
          })}
      </div>
    </div>
  );
}
