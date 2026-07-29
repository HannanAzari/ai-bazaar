"use client";

import { memo, useMemo, useState } from "react";
import { resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import { OverlayContent } from "@/components/nest/overlay-content";
import { inPaintOrder, placementStyle, SCENE_ASPECT } from "@/lib/nest-geometry";
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
function NestPreviewImpl({
  doc,
  className = "",
  rounded = "",
  safe,
  interactive = false,
}: {
  doc: NestDocument;
  className?: string;
  rounded?: string;
  /** Reserve top/bottom bands (fractions of height) that objects must stay clear of. */
  safe?: { top?: number; bottom?: number };
  /**
   * M24B §1 — the ONLY thing that may differ between modes.
   *
   * There is one renderer. Preview, the feed, a Profile card and a visitor all instantiate
   * this exact component with this exact document; `interactive` merely decides whether
   * the creator-configured hotspots and links respond to a tap. Nothing about the scene's
   * composition changes — no mode recomputes a position, a size or a paint order.
   */
  interactive?: boolean;
}) {
  const background = resolveBackground(doc.backgroundId);
  const [loaded, setLoaded] = useState(false);
  // P9 — sorting the placements is pure; doing it on every parent render was wasted work
  // on a list that changes only when the document does.
  const ordered = useMemo(() => inPaintOrder(doc.placements), [doc.placements]);

  // ── M24B §1 — THE SCENE IS A FIXED-ASPECT BOX, ALWAYS ──────────────────────
  //
  // This is the remaining displacement (the Welcome text, the photo, the bookshelf).
  //
  // The editor lays the scene out in a strict 3:4 box, so object percentages and the
  // background share ONE coordinate space. This renderer used to stretch its stage to
  // `inset: 0` of whatever container it was handed — in the full Nest that is roughly
  // 375×812 (aspect 0.46), in a feed card the same, on a Profile card something else
  // again. The background `<img>` then used `object-cover`, so it was CROPPED to fill
  // that box, while objects were still positioned as percentages of the CONTAINER.
  //
  // Background and objects therefore drifted apart by however much the container's aspect
  // differed from 3:4 — a systematic offset present on every surface, independent of the
  // w/h persistence fix, and DIFFERENT on each screen size. That is why the published
  // scene looked "reinterpreted" rather than replayed.
  //
  // The stage is now always the scene's aspect, centred and letterboxed inside whatever
  // container it is given, so a percentage resolves to the same point in the editor, in
  // Preview, in the feed and for a visitor. `object-contain` keeps the background in that
  // same space instead of cropping it out of alignment.
  //
  // `safe` still reserves top/bottom bands; it just does so inside the aspect-locked box.
  const stageStyle: React.CSSProperties | undefined = safe
    ? { top: `${(safe.top ?? 0) * 100}%`, bottom: `${(safe.bottom ?? 0) * 100}%`, left: 0, right: 0 }
    : undefined;

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
      {/* Flex-centre the scene, then lock its aspect. `h-full aspect-[3/4] max-w-full`
          fits the box inside the container on BOTH axes: a tall container clamps width,
          a wide one clamps height, and the aspect never changes. */}
      <div className="absolute inset-0 flex items-center justify-center" style={safe ? undefined : { containerType: "size" }}>
        <div
          className={safe ? "absolute overflow-hidden" : "relative overflow-hidden"}
          style={
            safe
              ? stageStyle
              : {
                  // Fit a SCENE_ASPECT box inside the container on both axes.
                  //
                  // `height:100%` + `aspect-ratio` + `max-width` does NOT work: an explicit
                  // height is definite, so aspect-ratio can only derive the width, and
                  // max-width then clamps it and breaks the ratio. Container-query units
                  // let the WIDTH be constrained by both axes up front, after which the
                  // height follows from the ratio and nothing needs clamping.
                  width: `min(100cqw, ${SCENE_ASPECT * 100}cqh)`,
                  aspectRatio: `${SCENE_ASPECT}`,
                }
          }
        >
        {background ? (
          // eslint-disable-next-line @next/next/no-img-element -- local curated art; next/image adds no value here
          <img
            src={background.variants.standard ?? background.imageUrl}
            alt={background.name}
            // `object-fill`, not `cover`: the stage already IS the scene's aspect, so
            // filling it is exact. `cover` would crop and re-introduce the offset.
            className={`absolute inset-0 size-full object-fill transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>
        )}

        {ordered.map((p, i) => {
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

          // M24B §1 — the creator's interaction travels with the placement, so a visitor
          // gets exactly what Preview showed. `linkUrl` and hotspots are replayed here
          // rather than being rebuilt by a separate visitor-only layer.
          const link = p.linkUrl;
          const asset = resolveAsset(p.assetId); // resolves archived assets too → cards never break
          if (!asset) {
            // M24 — an object the catalogue can't resolve used to `return null`, so it
            // simply VANISHED from the published Nest while still sitting in the editor.
            // That is the "some objects disappear" report, and silently dropping a
            // creator's work is exactly the failure mode this programme exists to remove.
            //
            // We keep its footprint and say what's wrong. In production it reads as a
            // quiet gap rather than a lie; in development it names the missing id.
            if (process.env.NODE_ENV !== "production") {
              console.warn(`[nest-preview] asset "${p.assetId}" is not in the library — rendering a placeholder.`);
            }
            return (
              <div key={p.id} className="absolute" style={style} aria-hidden>
                <div className="size-full rounded-lg border-2 border-dashed border-ink/25 bg-ink/[0.04]" />
              </div>
            );
          }
          const art = (
            /* eslint-disable-next-line @next/next/no-img-element -- local curated art */
            <img
              src={asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl}
              alt={asset.name}
              className="h-full w-full object-contain drop-shadow"
              loading="lazy"
            />
          );
          return (
            <div key={p.id} className="absolute" style={style} title={p.label || undefined}>
              {interactive && link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={p.label || asset.name}
                  className="block size-full"
                >
                  {art}
                </a>
              ) : (
                art
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

// P9 — the scene is memoised. Home re-renders on every social-store notification (a like
// anywhere bumps the store's version), and without this each of those re-laid-out every
// visible room. The document is replaced wholesale when it changes, so a reference check
// is exactly the right comparison.
export const NestPreview = memo(NestPreviewImpl);
