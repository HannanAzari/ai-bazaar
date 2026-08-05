"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Maximize2, Play, X } from "lucide-react";
import { resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import { OverlayContent } from "@/components/nest/overlay-content";
import { inPaintOrder, placementStyle, SCENE_ASPECT } from "@/lib/nest-geometry";
import {
  focusCameraTransform,
  focusObjectsInPaintOrder,
  placementFallbackInteraction,
  resolveFocusRegions,
  resolvePlacementHotspots,
  resolvePlacementSurfaces,
  type ResolvedHotspot,
} from "@/lib/nest-scene";
import { describeInteraction, youTubeEmbedUrl, type NestInteraction } from "@/lib/nest-interaction";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { SurfaceContent } from "@/lib/nest-surface-types";
import type { NestDocument, NestPlacement } from "@/lib/nest-document-types";

// ── M24E — THE canonical Nest runtime ────────────────────────────────────────
//
// One component renders and RUNS a Nest everywhere it appears: the editor's Preview, the
// full public Nest, the Home feed and every card. There is no second implementation and no
// behavioural branch between "editor-preview" and "visitor" — they are the same code path
// with the same document, which is the only way "what the creator built is what a visitor
// gets" can be true by construction rather than by vigilance.
//
// `mode` selects INPUT, never composition:
//
//   editor-preview  the creator testing their own Nest — fully interactive
//   visitor         someone else's Nest, full screen — fully interactive
//   card            a thumbnail in a feed/grid — inert, because the card itself is the
//                   tap target and a hotspot inside it would steal that tap
//
// M24D moved scene RESOLUTION into `lib/nest-scene.ts`. M24E moves scene EXECUTION here:
// focus navigation, hotspot hit targets and the typed interaction contract. Before this,
// the runtime read only `placement.linkUrl` — so hotspots the creator had bound to a URL
// rendered nothing and swallowed nothing, and a Nest was a background with static PNGs.

export type NestRuntimeMode = "editor-preview" | "visitor" | "card";

function NestRuntimeImpl({
  document: doc,
  mode,
  className = "",
  rounded = "",
  safe,
  surround = false,
}: {
  document: NestDocument;
  mode: NestRuntimeMode;
  className?: string;
  rounded?: string;
  /** Reserve top/bottom bands (fractions of height) that objects must stay clear of. */
  safe?: { top?: number; bottom?: number };
  /** Fill the space around the fixed-aspect scene with the adaptive matte (D-33). */
  surround?: boolean;
}) {
  // The ONLY thing mode decides. Composition, geometry and paint order are identical in
  // all three modes — asserted by test/nest-scene-renderer.test.ts.
  const interactive = mode !== "card";

  const background = resolveBackground(doc.backgroundId);
  const [loaded, setLoaded] = useState(false);
  const ordered = useMemo(() => inPaintOrder(doc.placements), [doc.placements]);
  const matte = useMemo(() => matteTintFor(doc.backgroundId), [doc.backgroundId]);

  // Focus navigation. `null` is the main scene. Both interactive modes share this exact
  // state machine — a creator testing Preview walks the same path a visitor will.
  const focusRegions = useMemo(() => resolveFocusRegions(doc), [doc]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const activeFocus = focusId ? focusRegions.find((f) => f.area.id === focusId) ?? null : null;
  const camera = activeFocus ? focusCameraTransform(activeFocus.crop) : null;

  // The inline video player, when a YouTube interaction is running.
  const [playing, setPlaying] = useState<{ videoId: string; label?: string } | null>(null);

  // Leaving a Nest (or switching document) must not strand the runtime inside a focus or
  // with a player open — both are view state, not creator data.
  useEffect(() => {
    setFocusId(null);
    setPlaying(null);
  }, [doc.id]);

  const run = useCallback((i: NestInteraction) => {
    switch (i.type) {
      case "enter-focus":
        setFocusId(i.focusId);
        return;
      case "open-youtube":
        // Plays in place. Leaving the Nest to watch a video is a worse experience than
        // watching it inside the room the creator built it into.
        setPlaying({ videoId: i.videoId, ...(i.label ? { label: i.label } : {}) });
        return;
      case "open-url":
        // An explicit, user-initiated navigation in a new tab. `noopener` so the opened
        // page cannot reach back into the Nest.
        window.open(i.url, "_blank", "noopener,noreferrer");
        return;
      case "none":
        return;
    }
  }, []);

  // Development-only: a hotspot the creator configured that cannot run must be VISIBLE,
  // never silently inert — a dead tap is indistinguishable from a runtime that forgot to
  // render the region, and that ambiguity is what made this sprint necessary.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    for (const p of doc.placements) {
      for (const h of resolvePlacementHotspots(p)) {
        if (h.problem) console.warn(`[nest-runtime] ${p.assetId}: ${h.problem}`);
      }
    }
  }, [doc.placements]);

  const stageStyle: React.CSSProperties | undefined = safe
    ? { top: `${(safe.top ?? 0) * 100}%`, bottom: `${(safe.bottom ?? 0) * 100}%`, left: 0, right: 0 }
    : undefined;

  return (
    // `isolate` is load-bearing: it contains the room's internal paint order inside the
    // room, so a sofa's zIndex cannot compete with the feed chrome around it (D-16/D-21).
    <div className={`relative isolate overflow-hidden bg-[#e9e0c8] ${rounded} ${className}`}>
      {background && !loaded ? <div className="nest-shimmer absolute inset-0" /> : null}

      {/* The adaptive matte (D-33). `pointer-events-none` inside, so decoration can never
          cover a hotspot's hit area — the failure mode M24E §Input handling calls out. */}
      {surround ? <SceneSurround tint={matte} /> : null}

      <div className="absolute inset-0 flex items-center justify-center" style={safe ? undefined : { containerType: "size" }}>
        <div
          className={safe ? "absolute overflow-hidden" : "relative overflow-hidden"}
          data-nest-stage=""
          style={
            safe
              ? stageStyle
              : {
                  // Container-query units fit a SCENE_ASPECT box inside the container on
                  // BOTH axes. `height:100%` + `aspect-ratio` + `max-width` does not work:
                  // a definite height lets aspect-ratio derive only the width, which
                  // max-width then clamps, breaking the ratio (D-25).
                  width: `min(100cqw, ${SCENE_ASPECT * 100}cqh)`,
                  aspectRatio: `${SCENE_ASPECT}`,
                }
          }
        >
          {/* ONE transform for the entire scene. Scaling THIS element moves the background,
              every object, every hotspot and every focus target together — which is what
              makes a focused view a camera move rather than a different layout (D-31). */}
          <div
            className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none"
            style={camera ? { transform: camera.transform, transformOrigin: camera.transformOrigin } : undefined}
          >
            {background ? (
              // eslint-disable-next-line @next/next/no-img-element -- local curated art
              <img
                src={background.variants.standard ?? background.imageUrl}
                alt={background.name}
                // `object-fill`, not `cover`: the stage already IS the scene's aspect.
                className={`absolute inset-0 size-full object-fill transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
                loading="lazy"
                onLoad={() => setLoaded(true)}
              />
            ) : (
              <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>
            )}

            {ordered.map((p, i) => (
              <PlacedObject key={p.id} placement={p} index={i} interactive={interactive} onRun={run} />
            ))}

            {/* Focus TARGETS. Main view only: inside a focus the region IS the view.
                A visitor gets a discoverable affordance, never the editor's rectangle. */}
            {interactive && !activeFocus
              ? focusRegions.map((f) => (
                  <button
                    key={f.area.id}
                    type="button"
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      run({ type: "enter-focus", focusId: f.area.id, ...(f.area.name ? { label: f.area.name } : {}) });
                    }}
                    aria-label={describeInteraction({ type: "enter-focus", focusId: f.area.id, ...(f.area.name ? { label: f.area.name } : {}) })}
                    className="group absolute cursor-pointer touch-manipulation rounded-2xl ring-1 ring-white/0 transition hover:ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    style={{
                      left: `${f.crop.x * 100}%`,
                      top: `${f.crop.y * 100}%`,
                      width: `${f.crop.width * 100}%`,
                      height: `${f.crop.height * 100}%`,
                      // Above the objects, below the return control and the player.
                      // M7C.2 focus-first: a Focus Area owns the first tap inside it.
                      zIndex: 900,
                    }}
                  >
                    <span className="absolute bottom-1 right-1 grid size-6 place-items-center rounded-full bg-black/45 text-white opacity-80 backdrop-blur-sm transition group-hover:opacity-100">
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
                <FocusChild key={o.instanceId} object={o} interactive={interactive} onRun={run} />
              ))
            : null}

          {/* Return to the main scene. A visitor who cannot get back out is trapped. */}
          {interactive && activeFocus ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setFocusId(null);
              }}
              className="absolute left-3 top-3 inline-flex touch-manipulation items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition active:scale-95"
              style={{ zIndex: 950 }}
            >
              <ArrowLeft className="size-3.5" /> Back to the room
            </button>
          ) : null}

          {/* The inline player. Inside the stage, so it is framed by the room. */}
          {playing ? <VideoOverlay videoId={playing.videoId} label={playing.label} onClose={() => setPlaying(null)} /> : null}
        </div>
      </div>
    </div>
  );
}

// ── One placed object: art, surfaces, hotspots ───────────────────────────────

function PlacedObject({
  placement: p,
  index,
  interactive,
  onRun,
}: {
  placement: NestPlacement;
  index: number;
  interactive: boolean;
  onRun: (i: NestInteraction) => void;
}) {
  const style = placementStyle(p, index);

  // Overlays (text / image stickers) are creator content, not catalogue assets.
  if (p.overlay) {
    return (
      <div className="absolute" style={style}>
        <OverlayContent overlay={p.overlay} />
      </div>
    );
  }

  const asset = resolveAsset(p.assetId);
  if (!asset) {
    // An unresolvable object used to `return null` and simply VANISH from the published
    // Nest while still sitting in the editor. We keep its footprint and say what's wrong.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[nest-runtime] asset "${p.assetId}" is not in the library — rendering a placeholder.`);
    }
    return (
      <div className="absolute" style={style} aria-hidden>
        <div className="size-full rounded-lg border-2 border-dashed border-ink/25 bg-ink/[0.04]" />
      </div>
    );
  }

  const surfaces = resolvePlacementSurfaces(p);
  const hotspots = interactive ? resolvePlacementHotspots(p) : [];
  // Only when NO hotspot claims the object — a hotspot is the more specific thing the
  // creator drew, and an object-wide link under it would make the whole room clickable.
  const fallback = interactive ? placementFallbackInteraction(p) : { type: "none" as const };

  return (
    <div className="absolute" style={style} title={p.label || undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local curated art */}
      <img
        src={asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl}
        alt={asset.name}
        className="absolute inset-0 h-full w-full object-contain drop-shadow"
        loading="lazy"
      />

      {/* SURFACE CONTENT — what is shown. Drawn into the asset-local rectangle from the
          catalogue, from the placement's own `interaction.surfaces` bag. Purely visual:
          `pointer-events-none` so it can never sit on top of the hotspot that makes it
          tappable. Separating "what is shown" from "what happens" is M24E §Surface. */}
      {surfaces.map((sf) => (
        <span
          key={sf.id}
          className="pointer-events-none absolute overflow-hidden"
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

      {/* SURFACE / OBJECT INTERACTION — what happens. One button per configured hotspot,
          in the creator's own asset-local geometry, so it scales, rotates and flips with
          the object automatically. */}
      {hotspots.map((h) => (
        <HotspotTarget key={h.id} hotspot={h} onRun={onRun} />
      ))}

      {/* The whole-object link, only when the creator drew no hotspot. */}
      {fallback.type !== "none" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRun(fallback);
          }}
          aria-label={p.label || describeInteraction(fallback) || asset.name}
          className="absolute inset-0 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        />
      ) : null}
    </div>
  );
}

/**
 * One interactive region on an object.
 *
 * A real `<button>`, so keyboard activation and screen-reader semantics come for free.
 * `touch-manipulation` removes the 300ms tap delay on mobile, and `onPointerUp` stops the
 * event before an ancestor drag handler (the editor canvas, the feed's swipe) can claim it
 * — the "Preview taps do nothing on a phone" failure mode.
 */
function HotspotTarget({ hotspot: h, onRun }: { hotspot: ResolvedHotspot; onRun: (i: NestInteraction) => void }) {
  const dead = h.interaction.type === "none";
  return (
    <button
      type="button"
      disabled={dead}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onRun(h.interaction);
      }}
      aria-label={h.ariaLabel}
      title={h.problem ?? undefined}
      className={`group absolute touch-manipulation rounded-[inherit] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
        dead ? "cursor-default" : "cursor-pointer"
      } ${h.ellipse ? "rounded-full" : "rounded-lg"} ${
        // A malformed hotspot is dashed-outlined in development so the creator can see the
        // thing that will not work, instead of tapping a region that silently does nothing.
        h.problem && process.env.NODE_ENV !== "production" ? "border-2 border-dashed border-amber-400/80" : ""
      }`}
      style={{
        left: `${h.bounds.x * 100}%`,
        top: `${h.bounds.y * 100}%`,
        width: `${h.bounds.width * 100}%`,
        height: `${h.bounds.height * 100}%`,
        zIndex: 5,
      }}
    >
      {/* A quiet affordance: nothing until hover/focus, so the room stays a room. */}
      {!dead ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="grid size-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            {h.interaction.type === "open-youtube" ? <Play className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </span>
        </span>
      ) : null}
    </button>
  );
}

/** One object inside a focus scene — same art resolution and interactions as the main scene. */
function FocusChild({
  object: o,
  interactive,
  onRun,
}: {
  object: EditableNestObject;
  interactive: boolean;
  onRun: (i: NestInteraction) => void;
}) {
  // A focus child carries the same authored interaction data as a main-scene object, so it
  // travels through the same resolver rather than a second, thinner code path.
  const asPlacement: NestPlacement = {
    id: o.instanceId,
    assetId: o.assetId,
    x: o.x,
    y: o.y,
    w: o.width,
    h: o.height,
    ...(o.overlay ? { overlay: o.overlay } : {}),
    ...(o.hotspots?.length || o.surfaces ? { interaction: { ...(o.hotspots?.length ? { hotspots: o.hotspots } : {}), ...(o.surfaces ? { surfaces: o.surfaces } : {}) } } : {}),
  };
  const surfaces = resolvePlacementSurfaces(asPlacement);
  const hotspots = interactive ? resolvePlacementHotspots(asPlacement) : [];
  const asset = o.overlay ? undefined : resolveAsset(o.assetId);

  return (
    <div
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
      {o.overlay ? (
        <OverlayContent overlay={o.overlay} />
      ) : asset ? (
        /* eslint-disable-next-line @next/next/no-img-element -- local curated art */
        <img
          src={asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl}
          alt={asset.name}
          className="absolute inset-0 h-full w-full object-contain drop-shadow"
          loading="lazy"
        />
      ) : (
        <div className="size-full rounded-lg border-2 border-dashed border-white/30 bg-white/5" />
      )}
      {surfaces.map((sf) => (
        <span
          key={sf.id}
          className="pointer-events-none absolute overflow-hidden"
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
      {hotspots.map((h) => (
        <HotspotTarget key={h.id} hotspot={h} onRun={onRun} />
      ))}
    </div>
  );
}

// ── The inline video player ──────────────────────────────────────────────────

/**
 * Plays a creator-bound YouTube video inside the Nest.
 *
 * `youtube-nocookie.com` so a visitor is not tracked for looking, and the id has already
 * been validated to 11 URL-safe characters by `youTubeVideoId` — nothing creator-supplied
 * reaches the iframe `src` unchecked.
 */
function VideoOverlay({ videoId, label, onClose }: { videoId: string; label?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 grid place-items-center bg-black/80 p-3 backdrop-blur-sm"
      style={{ zIndex: 1000 }}
      role="dialog"
      aria-modal="true"
      aria-label={label ? `Playing ${label}` : "Playing video"}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close video"
        className="absolute right-2 top-2 grid size-9 touch-manipulation place-items-center rounded-full bg-black/60 text-white transition active:scale-95"
      >
        <X className="size-4" />
      </button>
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lift">
        <iframe
          src={youTubeEmbedUrl(videoId)}
          title={label ?? "Video"}
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}

// ── The matte (D-33) ─────────────────────────────────────────────────────────

/**
 * A deep, desaturated colour derived from the room id.
 *
 * Deterministic rather than pixel-sampled: sampling would need the image decoded and would
 * flicker on every load, and the point is a calm surround, not an exact match.
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
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.05), transparent 38%, rgba(0,0,0,0.22))" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(58% 42% at 50% 46%, rgba(255,214,150,0.13), transparent 70%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 52%, rgba(0,0,0,0.42))" }} />
    </div>
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

// The scene is memoised: Home re-renders on every social-store notification, and without
// this each of those re-laid-out every visible room. The document is replaced wholesale
// when it changes, so a reference check is exactly the right comparison.
export const NestRuntime = memo(NestRuntimeImpl);
