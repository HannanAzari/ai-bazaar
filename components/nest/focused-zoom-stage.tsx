"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { GoldenLivingNestStage } from "@/components/nest/golden-living-nest-stage";
import type { Interaction, ComposedNest } from "@/lib/nest-types";
import type { LivingNestAsset, LivingNestTemplate } from "@/lib/nest-visual-types";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import type { NestFocusArea, NestFocusBounds } from "@/lib/nest-focus-types";
import {
  cinematicFocusTransformCss,
  cropLocalRectToScene,
  focusBoundsOf,
  zoomRegionChildren,
} from "@/lib/nest-focus-scenes";
import { selectFocusImageSource } from "@/lib/nest-focus-resolution";

// ── In-place cinematic focus stage (M7C.4) ───────────────────────────────────
//
// ONE Nest viewport (same position, size, radius). The scene (background + objects +
// hotspots + child assets) is a SINGLE transformed layer: `focusBounds` undefined ⇒
// identity (Main); set ⇒ the cinematic transform that makes that rectangle fill the
// viewport. There is NO modal, NO backdrop, NO second stage. The CSS transition animates
// the camera into / out of the area. Overlay chrome is passed as `children`.

type StagePair = { template: LivingNestTemplate; composed: ComposedNest };

export function CinematicFocusStage({
  stage,
  assetsById,
  interactionsById,
  aspectRatio = "3:4",
  focusBounds,
  childFa,
  childStage,
  childActive = false,
  debug = false,
  transitionMs = 540,
  reduced = false,
  card = true,
  focusOverlay,
  children,
}: {
  stage: StagePair;
  assetsById: Record<string, LivingNestAsset>;
  interactionsById: Record<string, Interaction>;
  aspectRatio?: string;
  /** Undefined = identity (Main view); set = cinematic zoom to this rectangle. */
  focusBounds?: NestFocusBounds;
  /** Legacy: a focus area whose `zoomRegion.childObjects` overlay the zoom (M7C.1). */
  childFa?: NestFocusArea;
  /** M7C.6: the CHILD SCENE's objects, rendered transparently over the parent-crop base
   *  (0..1 of the focused viewport) with full hotspots/interactions. */
  childStage?: StagePair;
  childActive?: boolean;
  debug?: boolean;
  transitionMs?: number;
  reduced?: boolean;
  /** Render the Nest card chrome (rounded/border/shadow). */
  card?: boolean;
  /** M7C.8: inherited parent interaction proxies — above the child stage, below chrome. */
  focusOverlay?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`nest-stage-viewport relative mx-auto w-full overflow-hidden ${card ? "rounded-[28px] border border-ink/10 shadow-xl" : ""}`}
      style={{ maxWidth: "min(94vw, 460px)", aspectRatio: aspectRatio.replace(":", " / ") }}
    >
      {/* Parent-crop visual base — the SAME shared renderer used during the animation, after
       *  it settles, AND by the child editor (M7C.7). Interactive only in the un-focused Main
       *  view; read-only once a focus rectangle is set (the child overlay owns interaction). */}
      <FocusedParentBase
        parentStage={stage}
        assetsById={assetsById}
        interactionsById={interactionsById}
        focusBounds={focusBounds}
        transitionMs={transitionMs}
        reduced={reduced}
        debug={debug}
        interactive={!focusBounds}
      >
        {childFa && !childStage ? <ZoomChildren fa={childFa} active={childActive} assetsById={assetsById} debug={debug} /> : null}
      </FocusedParentBase>
      {/* Child SCENE objects — 0..1 of the focused viewport, over the base, full interactions. */}
      {childStage ? (
        <div className="absolute inset-0" style={{ opacity: childActive ? 1 : 0, transition: "opacity .3s ease", pointerEvents: childActive ? "auto" : "none" }}>
          <GoldenLivingNestStage template={childStage.template} assetsById={assetsById} interactionsById={interactionsById} composed={childStage.composed} debugHotspots={debug} fill transparent />
        </div>
      ) : null}
      {/* Inherited parent interaction proxies (M7C.8) — above native child objects' container
       *  but pointer-events-none except for precise hotspots; below the focus chrome. */}
      {focusOverlay}
      {children}
    </div>
  );
}

// ── Shared parent-crop base (M7C.7) ──────────────────────────────────────────
//
// The ONE renderer for the permanent transformed parent-scene base. `focusBounds` set ⇒
// the cinematic cover transform makes that rectangle fill the viewport; undefined ⇒
// identity (the un-focused Main view). Used by `CinematicFocusStage` (preview, during AND
// after the animation) and by the child editor's canvas background — so the base a creator
// authors over is pixel-identical to what a visitor sees. Read-only unless `interactive`.
export function FocusedParentBase({
  parentStage,
  assetsById,
  interactionsById,
  focusBounds,
  transitionMs,
  reduced = false,
  debug = false,
  interactive = false,
  children,
}: {
  parentStage: StagePair;
  assetsById: Record<string, LivingNestAsset>;
  interactionsById: Record<string, Interaction>;
  focusBounds?: NestFocusBounds;
  transitionMs?: number;
  reduced?: boolean;
  debug?: boolean;
  /** Allow taps to reach the base (only the un-focused Main view); else it is a backdrop. */
  interactive?: boolean;
  children?: React.ReactNode;
}) {
  const t = focusBounds ? cinematicFocusTransformCss(focusBounds) : null;
  return (
    <div
      className="absolute inset-0"
      style={{
        transform: t ? t.transform : "none",
        transformOrigin: t ? t.transformOrigin : "0 0",
        transition: reduced || transitionMs == null ? "none" : `transform ${transitionMs}ms cubic-bezier(.22,.61,.36,1)`,
        willChange: "transform",
        pointerEvents: interactive ? undefined : "none",
      }}
    >
      <GoldenLivingNestStage template={parentStage.template} assetsById={assetsById} interactionsById={interactionsById} composed={parentStage.composed} debugHotspots={debug} fill />
      {children}
    </div>
  );
}

// ── Zoom-region child objects (crop-LOCAL to focusBounds; active only after focus) ──
export function ZoomChildren({ fa, active, assetsById, debug }: { fa: NestFocusArea; active: boolean; assetsById: Record<string, LivingNestAsset>; debug: boolean }) {
  const { objects } = useMemo(() => zoomRegionChildren(fa), [fa]);
  const region: NestFocusBounds = focusBoundsOf(fa);
  const [picked, setPicked] = useState<{ name: string; href?: string; label?: string } | null>(null);
  const [hiResLoaded, setHiResLoaded] = useState(false);

  useEffect(() => {
    const hi = fa.zoomRegion?.imageSources?.highResolutionUrl;
    if (!active || !hi || typeof window === "undefined") return;
    const img = new window.Image();
    img.onload = () => setHiResLoaded(true);
    img.src = hi;
    return () => { img.onload = null; };
  }, [active, fa]);

  if (objects.length === 0) return null;
  return (
    <>
      {objects.map((o) => {
        const box = cropLocalRectToScene({ x: o.x, y: o.y, width: o.width, height: o.height }, region);
        const asset = assetsById[o.assetId];
        const src = selectFocusImageSource({ standardUrl: asset?.imageUrl, highResolutionUrl: fa.zoomRegion?.imageSources?.highResolutionUrl }, hiResLoaded) ?? asset?.imageUrl;
        return (
          <div
            key={o.instanceId}
            className="absolute"
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
              zIndex: 50 + (o.zIndex ?? 0),
              opacity: active ? 1 : 0,
              transform: active ? "scale(1)" : "scale(.92)",
              transition: "opacity .3s ease, transform .3s ease",
              pointerEvents: active ? "auto" : "none",
            }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain object-bottom" />
            ) : null}
            {(o.hotspots ?? []).map((h: NestAssetHotspot) => (
              <button
                key={h.id}
                type="button"
                disabled={!active || !h.enabled}
                onClick={(e) => { e.stopPropagation(); setPicked({ name: h.name, href: h.binding?.url, label: h.binding?.label ?? h.semantic }); }}
                aria-label={h.ariaLabel ?? h.name}
                className={`absolute ${debug ? "outline outline-2 outline-dashed outline-meadow/80" : ""}`}
                style={{ left: `${h.shape.x * 100}%`, top: `${h.shape.y * 100}%`, width: `${h.shape.width * 100}%`, height: `${h.shape.height * 100}%`, borderRadius: h.shape.type === "ellipse" ? "9999px" : 4 }}
              />
            ))}
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
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
