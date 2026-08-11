"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Sparkles, X } from "lucide-react";
import { resolveAsset, resolveBackground } from "@/lib/nest-production-library";
import { OverlayContent } from "@/components/nest/overlay-content";
import { placementDisplayContent } from "@/lib/nest-object-display";
import { boxTransform, inPaintOrder, placementStyle, SCENE_ASPECT } from "@/lib/nest-geometry";
import {
  focusCameraTransform,
  focusObjectsInPaintOrder,
  placementFallbackInteraction,
  resolveFocusRegions,
  resolvePlacementHotspots,
  resolvePlacementSurfaces,
} from "@/lib/nest-scene";
import {
  audioFor,
  capabilitiesForAsset,
  initialStateOf,
  isInteractiveObject,
  resolveConnection,
  tapObject,
  visualStateOf,
} from "@/lib/nest-asset-interaction";
import { describeInteraction, youTubeEmbedUrl, type NestInteraction } from "@/lib/nest-interaction";
import { useSceneCamera } from "@/components/nest/app-shell/use-scene-camera";
import { CAMERA_MAX_SCALE, resolveTapTarget, type Camera, type TapCandidate } from "@/lib/nest-camera";
import { NestStage } from "@/components/nest/nest-stage";
import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { SurfaceContent } from "@/lib/nest-surface-types";
import type { NestDocument, NestPlacement } from "@/lib/nest-document-types";

// ── M25 — THE canonical Nest runtime ─────────────────────────────────────────
//
// One component renders and RUNS a Nest everywhere: the editor Preview, the full public
// Nest, the Home feed and every card. `mode` selects INPUT, never composition.
//
// M25 replaces the Focus-first model with two independent systems:
//
//   A — FREE EXPLORATION. The whole room pinch-zooms and pans to ~5×. Small objects are
//       inspected by zooming in, not by authoring a Focus region. The camera is a viewport
//       transform driven through refs (`use-scene-camera.ts`); the scene subtree does not
//       re-render while a finger is down.
//
//   B — OBJECT INTERACTION. The OBJECT is the hit target. There are no permanent hotspot
//       badges and no pinch icon in the room — a room full of affordance chrome stops
//       looking like a room. Discovery is a one-time hint plus an on-demand Hint pulse.
//
// Legacy Focus regions still play (see `LegacyFocus` below) so published Nests keep
// working, but nothing new needs one.

export type NestRuntimeMode = "editor-preview" | "visitor" | "card";

/** Visitor-session object states. Never written to Supabase — see D-40. */
type SessionStates = Record<string, string>;

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
  safe?: { top?: number; bottom?: number };
  surround?: boolean;
}) {
  // The ONLY thing mode decides.
  const interactive = mode !== "card";

  const background = resolveBackground(doc.backgroundId);
  const [loaded, setLoaded] = useState(false);
  const ordered = useMemo(() => inPaintOrder(doc.placements), [doc.placements]);

  // ── Object state ───────────────────────────────────────────────────────────
  // Authored initial state comes from the document; a tap changes only this session's
  // copy. Re-derived when the document changes so Preview reflects an edit immediately.
  const authored = useMemo(() => {
    const out: SessionStates = {};
    for (const p of doc.placements) {
      const s = initialStateOf(p);
      if (s) out[p.id] = s;
    }
    return out;
  }, [doc.placements]);
  const [session, setSession] = useState<SessionStates>(authored);
  useEffect(() => setSession(authored), [authored]);

  const [media, setMedia] = useState<NestInteraction | null>(null);
  const [hinting, setHinting] = useState(false);
  const savedCamera = useRef<Camera | null>(null);

  const interactiveIds = useMemo(
    () => new Set(doc.placements.filter((p) => isInteractiveObject(p) || resolvePlacementHotspots(p).length).map((p) => p.id)),
    [doc.placements],
  );

  // ── Legacy Focus (read-only compatibility) ─────────────────────────────────
  const focusRegions = useMemo(() => resolveFocusRegions(doc), [doc]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const activeFocus = focusId ? focusRegions.find((f) => f.area.id === focusId) ?? null : null;
  const focusCam = activeFocus ? focusCameraTransform(activeFocus.crop) : null;

  const run = useCallback((i: NestInteraction | null) => {
    if (!i) return;
    switch (i.type) {
      case "enter-focus":
        setFocusId(i.focusId);
        return;
      case "open-youtube":
      case "open-url":
        setMedia(i);
        return;
      case "none":
        return;
    }
  }, []);

  /** A tap on an object: change its state, then open anything it is connected to. */
  const onObjectTap = useCallback(
    (p: NestPlacement) => {
      const current = session[p.id] ?? initialStateOf(p);
      const result = tapObject(p, current);
      if (result.state) setSession((s) => ({ ...s, [p.id]: result.state as string }));
      if (result.open) {
        run(result.open);
        return;
      }
      // No capability configured ⇒ fall back to whatever M24E resolved for this object, so
      // Nests published before M25 keep behaving exactly as they did.
      if (!capabilitiesForAsset(p.assetId)) {
        const legacy = resolvePlacementHotspots(p)[0]?.interaction ?? placementFallbackInteraction(p);
        run(legacy);
      }
    },
    [session, run],
  );

  // The camera owns the tap: it only calls back when the gesture was a TAP, not a pan.
  const onSceneTap = useCallback(
    (point: { x: number; y: number }) => {
      if (!interactive) return;
      const el = window.document.elementFromPoint(point.x, point.y);
      const holder = el?.closest?.("[data-object-id]") as HTMLElement | null;
      if (!holder) return;

      // Tiny objects carry an invisible touch pad, so two books side by side on a shelf
      // have pads that overlap completely and `elementFromPoint` alone picks whichever
      // painted last. Gather every target whose PADDED area covers the point and let
      // `resolveTapTarget` apply the visual-containment-then-nearest-centre rule.
      const root = holder.closest("[data-nest-stage]") ?? holder.parentElement;
      const candidates: TapCandidate[] = [];
      for (const node of Array.from(root?.querySelectorAll<HTMLElement>("[data-object-id]") ?? [])) {
        const padded = node.getBoundingClientRect();
        const PAD = 14;
        if (
          point.x < padded.left - PAD || point.x > padded.right + PAD ||
          point.y < padded.top - PAD || point.y > padded.bottom + PAD
        ) continue;
        candidates.push({
          id: node.dataset.objectId ?? "",
          rect: { left: padded.left, top: padded.top, width: padded.width, height: padded.height },
          zIndex: Number(node.style.zIndex || 0),
        });
      }
      const id = resolveTapTarget(candidates, point) ?? holder.dataset.objectId;
      if (!id) return;
      if (id.startsWith("focus:")) {
        run({ type: "enter-focus", focusId: id.slice(6) });
        return;
      }
      const p = doc.placements.find((q) => q.id === id);
      if (p) onObjectTap(p);
    },
    [interactive, doc.placements, onObjectTap, run],
  );

  const camera = useSceneCamera({ onTap: onSceneTap, enabled: interactive });

  // Opening media remembers where the visitor was standing; closing puts them back, so
  // watching a video never costs them the spot they zoomed into.
  useEffect(() => {
    if (media) savedCamera.current = camera.read();
  }, [media, camera]);
  const closeMedia = useCallback(() => {
    setMedia(null);
    if (savedCamera.current) camera.restore(savedCamera.current);
  }, [camera]);

  // Leaving a Nest must not carry state into the next one.
  useEffect(() => {
    setFocusId(null);
    setMedia(null);
  }, [doc.id]);

  const pulse = useCallback(() => {
    setHinting(true);
    const t = setTimeout(() => setHinting(false), 1800);
    return () => clearTimeout(t);
  }, []);

  const stageStyle: React.CSSProperties | undefined = safe
    ? { top: `${(safe.top ?? 0) * 100}%`, bottom: `${(safe.bottom ?? 0) * 100}%`, left: 0, right: 0 }
    : undefined;

  return (
    // ── M26A §1 — the room sits on a STAGE ──────────────────────────────────
    //
    // `NestStage` is the app environment; `NestViewport` is the clipping box the camera is
    // attached to; the transformed stage inside it is the canonical 3:4 scene. The Stage is
    // never part of the Nest document, so it can be redesigned without touching a single
    // published Nest.
    <NestStage theme="dark" rounded={rounded} className={surround ? className : `bg-[#e9e0c8] ${className}`}>
      {background && !loaded ? <div className="nest-shimmer absolute inset-0" /> : null}

      <div className="absolute inset-0 flex items-center justify-center" style={safe ? undefined : { containerType: "size" }}>
        <div
          ref={camera.viewportRef}
          className={safe ? "absolute overflow-hidden" : "relative overflow-hidden"}
          data-nest-viewport=""
          style={{
            ...(safe
              ? stageStyle
              : { width: `min(100cqw, ${SCENE_ASPECT * 100}cqh)`, aspectRatio: `${SCENE_ASPECT}` }),
            touchAction: interactive ? "none" : undefined,
            ...(surround ? { boxShadow: "0 24px 60px -18px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)" } : {}),
          }}
        >
          <div
            ref={camera.stageRef}
            data-nest-stage=""
            className="absolute inset-0 origin-center will-change-transform"
          >
            {/* The legacy-Focus camera is a SECOND transform, applied inside the free
                camera rather than beside it, so an old Nest's focus still works while
                zoomed. New Nests never enter this branch. */}
            <div
              className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none"
              style={focusCam ? { transform: focusCam.transform, transformOrigin: focusCam.transformOrigin } : undefined}
            >
              {background ? (
                // eslint-disable-next-line @next/next/no-img-element -- local curated art
                <img
                  src={background.variants.standard ?? background.imageUrl}
                  alt={background.name}
                  className={`absolute inset-0 size-full object-fill transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setLoaded(true)}
                />
              ) : (
                <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>
              )}

              {ordered.map((p, i) => (
                <PlacedObject
                  key={p.id}
                  placement={p}
                  index={i}
                  interactive={interactive}
                  state={session[p.id] ?? null}
                  hinting={hinting && interactiveIds.has(p.id)}
                />
              ))}

              {/* Legacy Focus regions stay TAPPABLE but carry no badge — the brief's "no
                  permanent icon in the room". They are invisible targets on old Nests. */}
              {interactive && !activeFocus
                ? focusRegions.map((f) => (
                    <div
                      key={f.area.id}
                      data-object-id={`focus:${f.area.id}`}
                      aria-label={describeInteraction({ type: "enter-focus", focusId: f.area.id, ...(f.area.name ? { label: f.area.name } : {}) })}
                      className={`absolute rounded-2xl ${hinting ? "nest-hint-pulse" : ""}`}
                      style={{
                        left: `${f.crop.x * 100}%`,
                        top: `${f.crop.y * 100}%`,
                        width: `${f.crop.width * 100}%`,
                        height: `${f.crop.height * 100}%`,
                        zIndex: 900,
                      }}
                    />
                  ))
                : null}
            </div>

            {activeFocus
              ? focusObjectsInPaintOrder(activeFocus.objects).map((o) => <FocusChild key={o.instanceId} object={o} />)
              : null}
          </div>

          {/* ── Room controls. Outside the stage, so the camera never moves them. ── */}
          {interactive ? (
            <RoomControls
              zoomed={camera.zoomed}
              onReset={camera.reset}
              onHint={pulse}
              inLegacyFocus={!!activeFocus}
              onExitFocus={() => setFocusId(null)}
              hidden={!!media}
            />
          ) : null}

          {interactive && !media ? <FirstVisitHint /> : null}

          {media ? <MediaOverlay interaction={media} onClose={closeMedia} /> : null}
        </div>
      </div>

      {/* Session audio: one element per speaker that is currently playing. Browsers only
          allow this after a real user gesture, which a tap is. */}
      {interactive
        ? doc.placements.map((p) => {
            const a = audioFor(p, session[p.id] ?? null);
            return a ? <audio key={`a-${p.id}`} src={a.url} loop={a.loop} autoPlay /> : null;
          })
        : null}
    </NestStage>
  );
}

// ── One placed object ────────────────────────────────────────────────────────

function PlacedObject({
  placement: p,
  index,
  interactive,
  state,
  hinting,
}: {
  placement: NestPlacement;
  index: number;
  interactive: boolean;
  state: string | null;
  hinting: boolean;
}) {
  const style = placementStyle(p, index);

  if (p.overlay) {
    return (
      <div className="absolute" style={style}>
        <OverlayContent overlay={p.overlay} />
      </div>
    );
  }

  const asset = resolveAsset(p.assetId);
  if (!asset) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[nest-runtime] asset "${p.assetId}" is not in the library — rendering a placeholder.`);
    }
    return (
      <div className="absolute" style={style} aria-hidden>
        <div className="size-full rounded-lg border-2 border-dashed border-ink/25 bg-ink/[0.04]" />
      </div>
    );
  }

  const visual = visualStateOf(p.assetId, state);
  const connection = resolveConnection(p);
  const surfaces = resolvePlacementSurfaces(p);
  const tappable = interactive && (isInteractiveObject(p) || resolvePlacementHotspots(p).length > 0);

  // ── M27B-1 §P1 — the ONE display resolver ─────────────────────────────────
  //
  // This used to inline the whole decision here:
  //
  //     visual?.showsScreen ? connection?.thumbnailUrl ?? (kind === "image" ? url : …)
  //
  // which is why a YouTube connection drew nothing — it has no `thumbnailUrl` and is not an
  // image, so the expression fell through to `undefined` even with the screen on. The
  // editor meanwhile had no equivalent expression at all. Both now ask the same function.
  const display = placementDisplayContent(p, state, "runtime");
  const screenSurfaceId = display?.surfaceId ?? capabilitiesForAsset(p.assetId)?.screenSurfaceId;
  const screenSrc = display?.src;
  const screenBounds = display?.bounds;

  return (
    <div
      className="absolute"
      style={style}
      title={p.label || undefined}
      // The OBJECT is the hit target — `data-object-id` is what the camera's tap
      // classifier hit-tests against. No rectangle to author, no icon to render.
      {...(tappable ? { "data-object-id": p.id, role: "button", tabIndex: 0, "aria-label": p.label || asset.name } : {})}
    >
      {/* An invisible minimum touch target for tiny objects. It grows the HIT area without
          changing the object's visual size — a 10px book on a shelf measures 10px on a
          phone and must still be tappable at 1×, but must not look 44px wide.
          
          It must NOT be `pointer-events-none`: an untappable pad extends nothing, which is
          exactly the bug this comment used to describe away. It is transparent and
          `aria-hidden`, and it sits FIRST in paint order inside the object, so a
          higher-z-index object's art always paints over a lower one's pad — which is what
          makes "the topmost object wins an overlapping tap" true without a second
          resolver. */}
      {tappable ? <span aria-hidden className="absolute" style={{ inset: "-14px", minWidth: 44, minHeight: 44 }} /> : null}

      {/* A local glow, for objects whose state is light (lamp, speaker indicator, TV). */}
      {visual?.glow ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-300"
          style={{
            width: `${visual.glow.scale * 100}%`,
            height: `${visual.glow.scale * 100}%`,
            background: `radial-gradient(circle, rgba(${visual.glow.color},${visual.glow.opacity}) 0%, transparent 68%)`,
            mixBlendMode: "screen",
          }}
        />
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element -- local curated art */}
      <img
        src={visual?.imageUrl ?? asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl}
        alt={asset.name}
        className={`absolute inset-0 h-full w-full object-contain drop-shadow transition-transform duration-150 ${
          hinting ? "nest-hint-pulse" : ""
        }`}
      />

      {/* Creator content drawn onto the object's own screen. Purely visual — the OBJECT is
          the tap target, so this is always pointer-events-none. */}
      {screenSrc && screenBounds ? (
        <span
          className="pointer-events-none absolute overflow-hidden"
          style={{
            left: `${screenBounds.x * 100}%`,
            top: `${screenBounds.y * 100}%`,
            width: `${screenBounds.width * 100}%`,
            height: `${screenBounds.height * 100}%`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- creator content */}
          <img src={screenSrc} alt="" className={`size-full ${display?.fit === "contain" ? "object-contain" : "object-cover"}`} loading="lazy" />
        </span>
      ) : null}

      {/* Legacy surface content (pre-M25 Nests) still draws. */}
      {surfaces
        .filter((sf) => sf.id !== screenSurfaceId || !screenSrc)
        .map((sf) => (
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
    </div>
  );
}

/** One object inside a legacy focus scene. */
function FocusChild({ object: o }: { object: EditableNestObject }) {
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
        transform: boxTransform(o), // M26-F §2 — the one transform contract
        transformOrigin: "center",
      }}
    >
      {o.overlay ? (
        <OverlayContent overlay={o.overlay} />
      ) : asset ? (
        /* eslint-disable-next-line @next/next/no-img-element -- local curated art */
        <img src={asset.variants.standard ?? asset.cutoutUrl ?? asset.imageUrl} alt={asset.name} className="absolute inset-0 h-full w-full object-contain drop-shadow" loading="lazy" />
      ) : (
        <div className="size-full rounded-lg border-2 border-dashed border-white/30 bg-white/5" />
      )}
    </div>
  );
}

// ── Room controls ────────────────────────────────────────────────────────────

/**
 * The only permanent chrome in the room, and it sits OUTSIDE the scene.
 *
 * There is no pinch icon and no hotspot badge: the brief's "no permanent clutter". Reset
 * appears only once the visitor has actually zoomed, so a room at rest is just a room.
 */
function RoomControls({
  zoomed,
  onReset,
  onHint,
  inLegacyFocus,
  onExitFocus,
  hidden,
}: {
  zoomed: boolean;
  onReset: () => void;
  onHint: () => void;
  inLegacyFocus: boolean;
  onExitFocus: () => void;
  hidden: boolean;
}) {
  if (hidden) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5" style={{ zIndex: 940 }}>
      <div className="flex gap-1.5">
        {inLegacyFocus ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onExitFocus}
            className="pointer-events-auto inline-flex touch-manipulation items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition active:scale-95"
          >
            Back to the room
          </button>
        ) : null}
        {zoomed ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onReset}
            aria-label="Reset the view"
            className="pointer-events-auto inline-flex touch-manipulation items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition active:scale-95"
          >
            <Maximize2 className="size-3.5" /> Reset view
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onHint}
        aria-label="Show what can be tapped"
        className="pointer-events-auto grid size-8 touch-manipulation place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition active:scale-95"
      >
        <Sparkles className="size-4" />
      </button>
    </div>
  );
}

const HINT_KEY = "nestudio:explore-hint-seen";

/** Shown once, ever, then never again. Teaches the gesture without becoming furniture. */
function FirstVisitHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(HINT_KEY)) return;
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      return; // private mode: skip the hint rather than showing it every single time
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4" style={{ zIndex: 930 }}>
      <p className="animate-[fadeIn_.4s_ease] rounded-full bg-black/55 px-3.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm">
        Tap objects and pinch to explore
      </p>
    </div>
  );
}

// ── Media ────────────────────────────────────────────────────────────────────

/**
 * Connected content, opened without losing the room.
 *
 * The room stays visible behind a dark scrim rather than being replaced, and closing
 * restores the exact camera the visitor had — a video should not cost you the corner you
 * zoomed into. Escape closes; so does the backdrop.
 */
function MediaOverlay({ interaction: i, onClose }: { interaction: NestInteraction; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Mobile back should dismiss the overlay, not leave the Nest.
    window.history.pushState({ nestMedia: true }, "");
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, [onClose]);

  const isVideo = i.type === "open-youtube";
  return (
    <div
      className="absolute inset-0 grid place-items-center bg-black/70 p-3 backdrop-blur-[2px]"
      style={{ zIndex: 1000 }}
      role="dialog"
      aria-modal="true"
      aria-label={describeInteraction(i)}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-2 grid size-9 touch-manipulation place-items-center rounded-full bg-black/60 text-white transition active:scale-95"
      >
        <X className="size-4" />
      </button>

      {isVideo && i.type === "open-youtube" ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lift">
          <iframe
            src={youTubeEmbedUrl(i.videoId)}
            title={i.label ?? "Video"}
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : i.type === "open-url" ? (
        // An external site cannot be framed reliably (and framing one silently is its own
        // problem), so this is an explicit, labelled hand-off rather than a surprise
        // navigation the visitor never asked for.
        <div className="w-full max-w-xs rounded-2xl bg-parchment p-4 text-center shadow-lift">
          <p className="display text-base text-ink">{i.label ?? "Open this link"}</p>
          <p className="mt-1 break-all text-[11px] text-ink/50">{new URL(i.url).hostname}</p>
          <a
            href={i.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-terracotta px-4 py-2.5 text-sm font-bold text-parchment"
          >
            Open in a new tab
          </a>
          <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl px-4 py-2 text-xs font-bold text-ink/55">
            Stay in the Nest
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Legacy creator-assigned surface content. */
function SurfaceContentView({ content }: { content: SurfaceContent }) {
  if (content.kind === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- creator upload */
      <img src={content.src} alt="" className={`size-full ${content.fit === "contain" ? "object-contain" : "object-cover"}`} loading="lazy" />
    );
  }
  if (content.kind === "sticker") {
    return <span className="grid size-full place-items-center text-[3vmin]">{content.emoji}</span>;
  }
  return (
    <span className="grid size-full place-items-center px-[4%] text-center text-[2.2vmin] font-bold leading-tight text-white">{content.text}</span>
  );
}

export const NestRuntime = memo(NestRuntimeImpl);
export { CAMERA_MAX_SCALE };
