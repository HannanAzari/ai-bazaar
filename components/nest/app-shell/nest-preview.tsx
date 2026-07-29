"use client";

import { memo, useMemo, useState } from "react";
import { resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import { OverlayContent } from "@/components/nest/overlay-content";
import { inPaintOrder, placementStyle, SCENE_ASPECT } from "@/lib/nest-geometry";
import { ArrowLeft, Maximize2 } from "lucide-react";
import { focusCameraTransform, focusObjectsInPaintOrder, resolveFocusRegions, resolvePlacementSurfaces } from "@/lib/nest-scene";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { SurfaceContent } from "@/lib/nest-surface-types";
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
  surround = false,
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
  /**
   * M24C §7 — fill the space around the fixed-aspect scene with a blurred, darkened copy
   * of the room's own background instead of flat colour. For immersive surfaces (the full
   * Nest, Editor Preview); off for thumbnails and cards, where there is no spare space.
   */
  surround?: boolean;
}) {
  const background = resolveBackground(doc.backgroundId);
  const [loaded, setLoaded] = useState(false);
  // P9 — sorting the placements is pure; doing it on every parent render was wasted work
  // on a list that changes only when the document does.
  const ordered = useMemo(() => inPaintOrder(doc.placements), [doc.placements]);

  // M24D §2 — one deep, desaturated colour derived from the room, so the matte belongs to
  // this Nest rather than being a generic grey. Deterministic from the background id, so
  // it never flickers between renders and needs no pixel sampling.
  const matte = useMemo(() => matteTintFor(doc.backgroundId), [doc.backgroundId]);

  // M24D §1 — focus navigation. `null` is the main scene. Preview and visitor share this
  // exact state machine; only the chrome around them differs.
  const focusRegions = useMemo(() => resolveFocusRegions(doc), [doc]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const activeFocus = focusId ? focusRegions.find((f) => f.area.id === focusId) ?? null : null;
  const camera = activeFocus ? focusCameraTransform(activeFocus.crop) : null;

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

      {/* ── M24D §2 — the adaptive matte ──────────────────────────────────────
          The previous treatment enlarged and blurred the room and laid a dark wash over
          it. On real rooms that produced visible green/beige/dark bands — it read as an
          accident rather than a frame.

          This is a restrained matte instead: ONE deep desaturated colour derived from the
          room, a soft vertical gradient, a gentle radial glow behind the scene and an edge
          vignette. No enlarged image, so there is nothing to band. The effect is a gallery
          wall or a theatre stage — the room is lit, the surround recedes.

          Geometry is untouched: this paints behind the fixed 3:4 stage and never moves it.
          It is also where a future 9:16 `immersiveBackgroundUrl` would render (see
          lib/nest-scene.ts) without changing a single object coordinate. */}
      {surround ? <SceneSurround tint={matte} /> : null}

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
        {/* One transform for the entire scene. Scaling THIS element moves the background,
            every object, every hotspot and every focus target together — which is what
            makes a focused view a camera move rather than a different layout. */}
        <div
          className="absolute inset-0 origin-center transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none"
          style={
            camera
              ? { transform: `scale(${camera.scale})`, transformOrigin: `${camera.originX}% ${camera.originY}%` }
              : undefined
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

        {/* M24D §1 — FOCUS: the camera moves the whole scene under one transform, so the
            background and every object travel together. A focused view is the main scene
            transformed, never a scene re-laid-out. */}
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
          const surfaces = resolvePlacementSurfaces(p);
          const withSurfaces = surfaces.length ? (
            <span className="absolute inset-0">
              {art}
              {/* M24D §1 — SURFACE: the creator's assigned content, drawn into the
                  asset-local rectangle from the catalogue. It comes from the placement's
                  own `interaction.surfaces` bag, so it needs no editor state and renders
                  identically in Preview and for a visitor. */}
              {surfaces.map((sf) => (
                <span
                  key={sf.id}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${sf.bounds.x * 100}%`,
                    top: `${sf.bounds.y * 100}%`,
                    width: `${sf.bounds.width * 100}%`,
                    height: `${sf.bounds.height * 100}%`,
                  }}
                >
                  <SurfaceContentView content={sf.content} />
                </span>
              ))}
            </span>
          ) : null;

          return (
            <div key={p.id} className="absolute" style={style} title={p.label || undefined}>
              {withSurfaces ? (
                interactive && link ? (
                  <a href={link} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} aria-label={p.label || asset.name} className="block size-full">
                    {withSurfaces}
                  </a>
                ) : (
                  withSurfaces
                )
              ) : interactive && link ? (
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

          {/* Focus TARGETS — only in the main view, and only when interactive. A visitor
              gets a discoverable tap area, never the editor's rectangle. */}
          {interactive && !activeFocus
            ? focusRegions.map((f) => (
                <button
                  key={f.area.id}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setFocusId(f.area.id); }}
                  aria-label={f.area.name ? `Look closer: ${f.area.name}` : "Look closer"}
                  className="absolute rounded-2xl ring-1 ring-white/0 transition hover:ring-white/40 focus-visible:ring-white/70"
                  style={{
                    left: `${f.crop.x * 100}%`,
                    top: `${f.crop.y * 100}%`,
                    width: `${f.crop.width * 100}%`,
                    height: `${f.crop.height * 100}%`,
                    zIndex: 900,
                  }}
                >
                  <span className="absolute bottom-1 right-1 grid size-6 place-items-center rounded-full bg-black/45 text-white opacity-80 backdrop-blur-sm">
                    <Maximize2 className="size-3" />
                  </span>
                </button>
              ))
            : null}
        </div>

        {/* Objects the creator placed INSIDE the focus. They live in the focused view's
            own 0..1 space (its base is the parent crop), so they are NOT under the camera
            transform — scaling them again would double-apply the zoom. */}
        {activeFocus
          ? focusObjectsInPaintOrder(activeFocus.objects).map((o) => (
              <div
                key={o.instanceId}
                className="absolute"
                style={{
                  left: `${o.x * 100}%`,
                  top: `${o.y * 100}%`,
                  width: `${o.width * 100}%`,
                  height: `${o.height * 100}%`,
                  zIndex: o.zIndex ?? 1,
                  transform: [o.rotation ? `rotate(${o.rotation}deg)` : "", o.flipX ? "scaleX(-1)" : ""].filter(Boolean).join(" ") || undefined,
                  transformOrigin: "center",
                }}
              >
                <FocusChild object={o} />
              </div>
            ))
          : null}

        {/* Return to the main scene. Present in BOTH modes — a visitor who cannot get back
            out of a focus is trapped. */}
        {interactive && activeFocus ? (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setFocusId(null); }}
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition active:scale-95"
            style={{ zIndex: 950 }}
          >
            <ArrowLeft className="size-3.5" /> Back to the room
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
}

// ── M24D §2 — the matte ──────────────────────────────────────────────────────

/**
 * A deep, desaturated colour derived from the room id.
 *
 * Deterministic rather than pixel-sampled: sampling would need the image decoded and would
 * flicker on every load, and the point is a calm surround, not an exact match. The hue
 * comes from the background id so each room keeps its own consistent frame; saturation and
 * lightness are pinned low so it always recedes behind the scene.
 */
function matteTintFor(backgroundId: string): string {
  let h = 0;
  for (let i = 0; i < backgroundId.length; i += 1) h = (h * 31 + backgroundId.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 14% 11%)`;
}

/** The gallery-wall surround: flat tint, soft gradient, glow behind the room, vignette. */
function SceneSurround({ tint }: { tint: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ backgroundColor: tint }}>
      {/* a barely-there vertical lift, so the matte is not a dead flat field */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.05), transparent 38%, rgba(0,0,0,0.22))" }} />
      {/* warm glow behind the room, as if it were lit on a stage */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(58% 42% at 50% 46%, rgba(255,214,150,0.13), transparent 70%)" }} />
      {/* edge vignette keeps the eye on the scene and the controls readable */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 52%, rgba(0,0,0,0.42))" }} />
    </div>
  );
}

/** One object inside a focus scene. Same art resolution as the main scene. */
function FocusChild({ object }: { object: EditableNestObject }) {
  if (object.overlay) return <OverlayContent overlay={object.overlay} />;
  const asset = resolveAsset(object.assetId);
  if (!asset) {
    return <div className="size-full rounded-lg border-2 border-dashed border-white/30 bg-white/5" />;
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- local curated art */
    <img
      src={asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl}
      alt={asset.name}
      className="h-full w-full object-contain drop-shadow"
      loading="lazy"
    />
  );
}


/** Creator-assigned surface content: an image, a line of text, or a sticker. */
function SurfaceContentView({ content }: { content: SurfaceContent }) {
  if (content.kind === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- creator upload / remote thumb */
      <img
        src={content.src}
        alt=""
        className={`size-full ${content.fit === "contain" ? "object-contain" : "object-cover"}`}
        loading="lazy"
      />
    );
  }
  if (content.kind === "sticker") {
    return <span className="grid size-full place-items-center text-[3vmin]">{content.emoji}</span>;
  }
  return (
    <span className="grid size-full place-items-center px-[4%] text-center text-[2.2vmin] font-bold leading-tight text-white">
      {content.text}
    </span>
  );
}

// P9 — the scene is memoised. Home re-renders on every social-store notification (a like
// anywhere bumps the store's version), and without this each of those re-laid-out every
// visible room. The document is replaced wholesale when it changes, so a reference check
// is exactly the right comparison.
export const NestPreview = memo(NestPreviewImpl);
