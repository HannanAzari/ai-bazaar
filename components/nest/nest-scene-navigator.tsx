"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { GoldenLivingNestStage } from "@/components/nest/golden-living-nest-stage";
import { CinematicFocusStage } from "@/components/nest/focused-zoom-stage";
import { ProjectedFocusChildren } from "@/components/nest/projected-focus-children";
import { InheritedInteractionLayer } from "@/components/nest/inherited-interaction-layer";
import { resolveInheritedFocusObjects } from "@/lib/nest-focus-projection";
import type { Interaction } from "@/lib/nest-types";
import type { LivingNestAsset, LivingNestTemplate } from "@/lib/nest-visual-types";
import type { EditableNestDocument } from "@/lib/nest-editor-types";
import { editorDocumentToStage } from "@/lib/nest-editor";
import type { NestFocusArea, NestNavigationState } from "@/lib/nest-focus-types";
import {
  beginEnter,
  beginExit,
  canNavigate,
  childSceneIdOf,
  detailSurfaceIdOf,
  focusBoundsOf,
  focusTargetTypeOf,
  focusTransitionDurationMs,
  getDetailScene,
  isVisitableFocusArea,
  mainSceneId,
  resolveMainScenePointerAction,
  selectDiscoveryHint,
  settleScene,
} from "@/lib/nest-focus-scenes";

export type { NestNavigationState } from "@/lib/nest-focus-types";

// ── Visitor scene navigator (M7C / M7C.1) ────────────────────────────────────
//
// Renders the current scene through the EXISTING Golden Living Nest stage and manages
// the hybrid Focus system:
//   • Zoom Region    — CSS-transforms the SAME Main scene so a crop fills the viewport
//                      (no scene swap); child objects/hotspots activate after entry.
//   • Detail Surface — transitions into a separately authored close-up scene (the
//                      original M7C path), rendered through the same stage.
// Both reverse cleanly on Back/Escape/browser-back, lock interaction mid-transition,
// and respect reduced motion. One navigation level. No WebGL, no animation library.

type Props = {
  doc: EditableNestDocument;
  assetsById: Record<string, LivingNestAsset>;
  interactionsById: Record<string, Interaction>;
  baseTemplate: LivingNestTemplate;
  /** Internal: reveal hotspot + focus-area debug overlays (off for visitors). */
  debug?: boolean;
  onSceneChange?: (sceneId: string) => void;
  /** Editor "Preview focus" shortcut: auto-enter this focus area once on mount. */
  autoEnterFocusId?: string;
};

/** Detect prefers-reduced-motion (visitor accessibility). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(m.matches);
    apply();
    m.addEventListener?.("change", apply);
    return () => m.removeEventListener?.("change", apply);
  }, []);
  return reduced;
}

type ZoomPhase = "entering" | "active" | "exiting";

export function NestSceneNavigator({ doc, assetsById, interactionsById, baseTemplate, debug = false, onSceneChange, autoEnterFocusId }: Props) {
  const main = mainSceneId(doc);
  const reduced = usePrefersReducedMotion();
  const dur = focusTransitionDurationMs(reduced);

  // Detail-surface navigation (M7C state machine).
  const [nav, setNav] = useState<NestNavigationState>({ currentSceneId: main, transitionState: "idle" });
  // Zoom-region state (M7C.1) — does NOT swap scenes; transforms the Main stage.
  const [zoom, setZoom] = useState<{ fa: NestFocusArea; phase: ZoomPhase } | null>(null);
  // Discovery state (M7C.2): a single transient first-visit hint, suppressed after the
  // first focus entry. No persistent visitor CTA.
  const [hasFocusedOnce, setHasFocusedOnce] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  const lockRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const affordanceRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  // The focus area that leads INTO the current detail scene (for the exit transform origin).
  const enteringFa = useRef<NestFocusArea | undefined>(undefined);

  // M7C.6 fix: editor-authored zoom areas (no `zoomRegion` payload, only `focusBounds`)
  // are visitable — the old gate hid them from Preview/visitor.
  const enabledFocusAreas = (doc.focusAreas ?? []).filter(isVisitableFocusArea);

  const finalize = useCallback(
    (sceneId: string) => {
      setNav(settleScene(sceneId));
      lockRef.current = false;
      onSceneChange?.(sceneId);
    },
    [onSceneChange],
  );

  // ── Detail Surface entry/exit (existing M7C path) ──
  const enterDetail = useCallback(
    (fa: NestFocusArea, pushHistory = true) => {
      const target = detailSurfaceIdOf(fa);
      if (lockRef.current || !target || !getDetailScene(doc, target)) return;
      lockRef.current = true;
      enteringFa.current = fa;
      setNav((n) => beginEnter(n));
      if (pushHistory && typeof window !== "undefined") {
        try {
          window.history.pushState({ nestScene: target }, "");
        } catch {
          /* history unavailable — navigation still works */
        }
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        finalize(target);
        window.setTimeout(() => detailHeadingRef.current?.focus({ preventScroll: true }), 0);
      }, dur);
    },
    [doc, dur, finalize],
  );

  const exitDetail = useCallback(
    (popHistory = true) => {
      if (lockRef.current || nav.currentSceneId === main) return;
      lockRef.current = true;
      setNav((n) => beginExit(n));
      if (popHistory && typeof window !== "undefined") {
        try {
          window.history.back();
        } catch {
          /* ok */
        }
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        finalize(main);
        window.setTimeout(() => affordanceRef.current?.focus({ preventScroll: true }), 0);
        enteringFa.current = undefined;
      }, dur);
    },
    [nav.currentSceneId, main, dur, finalize],
  );

  // ── Zoom Region entry/exit (M7C.1 crop zoom) ──
  const enterZoom = useCallback(
    (fa: NestFocusArea, pushHistory = true) => {
      if (lockRef.current) return;
      lockRef.current = true;
      enteringFa.current = fa;
      setZoom({ fa, phase: "entering" });
      if (pushHistory && typeof window !== "undefined") {
        try {
          window.history.pushState({ nestZoom: fa.id }, "");
        } catch {
          /* ok */
        }
      }
      clearTimeout(zoomTimer.current);
      zoomTimer.current = setTimeout(() => {
        setZoom({ fa, phase: "active" });
        lockRef.current = false;
        window.setTimeout(() => detailHeadingRef.current?.focus({ preventScroll: true }), 0);
      }, dur);
    },
    [dur],
  );

  const exitZoom = useCallback(
    (popHistory = true) => {
      if (lockRef.current || !zoom) return;
      lockRef.current = true;
      setZoom((z) => (z ? { ...z, phase: "exiting" } : null));
      if (popHistory && typeof window !== "undefined") {
        try {
          window.history.back();
        } catch {
          /* ok */
        }
      }
      clearTimeout(zoomTimer.current);
      zoomTimer.current = setTimeout(() => {
        setZoom(null);
        lockRef.current = false;
        window.setTimeout(() => affordanceRef.current?.focus({ preventScroll: true }), 0);
        enteringFa.current = undefined;
      }, dur);
    },
    [dur, zoom],
  );

  const enter = useCallback(
    (fa: NestFocusArea) => {
      // Focus-first (M7C.2): a Focus Area owns the first tap; entering one marks the
      // visitor as having discovered the pattern, so later hints are suppressed.
      setHasFocusedOnce(true);
      setHintVisible(false);
      if (focusTargetTypeOf(fa) === "zoom_region") enterZoom(fa);
      else enterDetail(fa);
    },
    [enterZoom, enterDetail],
  );

  // Editor "Preview focus" shortcut: auto-enter the requested area once after mount,
  // through the SAME navigator path the visitor uses (no separate preview component).
  const autoEnteredRef = useRef(false);
  useEffect(() => {
    if (autoEnteredRef.current || !autoEnterFocusId) return;
    const fa = (doc.focusAreas ?? []).find((f) => f.id === autoEnterFocusId);
    if (!fa) return;
    autoEnteredRef.current = true;
    const t = window.setTimeout(() => enter(fa), 90);
    return () => window.clearTimeout(t);
  }, [autoEnterFocusId, doc, enter]);

  // Browser back closes a detail scene or a zoom.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      if (lockRef.current) return;
      if (zoom) exitZoom(false);
      else if (nav.currentSceneId !== main) exitDetail(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [nav.currentSceneId, main, zoom, exitZoom, exitDetail]);

  // Escape returns from a detail scene or zoom.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || lockRef.current) return;
      if (zoom) {
        e.stopPropagation();
        exitZoom();
      } else if (nav.currentSceneId !== main) {
        e.stopPropagation();
        exitDetail();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav.currentSceneId, main, zoom, exitZoom, exitDetail]);

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(zoomTimer.current); }, []);

  // First-visit discovery hint auto-fades shortly after load (Phase 8) — non-blocking.
  useEffect(() => {
    if (hasFocusedOnce) return;
    const t = window.setTimeout(() => setHintVisible(false), 3800);
    return () => window.clearTimeout(t);
  }, [hasFocusedOnce]);

  // Lock document scroll while a full-screen Zoom Region is open (Phase 2); restore on exit.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!zoom) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [zoom]);

  // Focus-first single-tap fallback (e.g. taps reaching the scene). A Focus Area owns the
  // tap; only when none claims it does a stage hotspot/object act (the stage handles that).
  function onPointerNavigate(e: React.MouseEvent) {
    if (!canNavigate(nav) || lockRef.current || nav.currentSceneId !== main || zoom) return;
    const sceneEl = (e.target as HTMLElement).closest(".living-scene") as HTMLElement | null;
    if (!sceneEl) return;
    const r = sceneEl.getBoundingClientRect();
    if (r.width <= 0) return;
    const point = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    const res = resolveMainScenePointerAction({ point, focusAreas: enabledFocusAreas, objects: doc.objects });
    if (res.type === "focus") {
      const f = enabledFocusAreas.find((a) => a.id === res.focusAreaId);
      if (f) enter(f);
    }
  }

  // Build the {template, composed} pair for a scene id (main = the doc; detail = its manifest).
  function stageFor(sceneId: string) {
    if (sceneId === main) return editorDocumentToStage(doc, assetsById, baseTemplate);
    const scene = getDetailScene(doc, sceneId);
    if (!scene) return editorDocumentToStage(doc, assetsById, baseTemplate);
    const synthetic: EditableNestDocument = {
      ...doc,
      id: `${doc.id}--${scene.id}`,
      objects: scene.objects,
      backgroundImageUrl: scene.backgroundImageUrl ?? doc.backgroundImageUrl,
      aspectRatio: scene.viewport.aspectRatio,
      ambiencePresetId: scene.ambiencePresetId ?? doc.ambiencePresetId,
      focusAreas: [],
      detailScenes: [],
    };
    return editorDocumentToStage(synthetic, assetsById, baseTemplate);
  }

  function Stage({ sceneId }: { sceneId: string }) {
    const s = stageFor(sceneId);
    return <GoldenLivingNestStage template={s.template} assetsById={assetsById} interactionsById={interactionsById} composed={s.composed} debugHotspots={debug} />;
  }

  const isMain = nav.currentSceneId === main;
  const transitioning = nav.transitionState !== "idle";
  const fa = enteringFa.current;
  const origin = fa ? `${(fa.bounds.x + fa.bounds.width / 2) * 100}% ${(fa.bounds.y + fa.bounds.height / 2) * 100}%` : "50% 50%";
  const detailScene = !isMain ? getDetailScene(doc, nav.currentSceneId) : undefined;
  const detailTitle = detailScene?.name ?? "Detail";

  const zoomActive = Boolean(zoom);
  const hint = selectDiscoveryHint(enabledFocusAreas, { hasFocusedOnce, reducedMotion: reduced });
  const showHint = hintVisible && !hasFocusedOnce && isMain && !transitioning && !zoomActive;

  // Detail-surface flow keeps the M7C layered transition; the Main scene + in-place Zoom
  // Region use ONE CinematicFocusStage (no modal, no duplicate stage).
  const inDetailFlow = !isMain || transitioning;
  // The cinematic focus rectangle — undefined ⇒ identity (Main / exit), set ⇒ zoom in.
  const zoomFocusBounds = zoom && zoom.phase !== "exiting" ? focusBoundsOf(zoom.fa) : undefined;
  // The child SCENE rendered over the parent-crop base (if the area links one).
  const zoomChildSceneId = (() => {
    if (!zoom) return undefined;
    const id = childSceneIdOf(zoom.fa);
    return id && getDetailScene(doc, id) ? id : undefined;
  })();

  return (
    <div className="nest-nav relative mx-auto w-full" style={{ maxWidth: "min(94vw, 460px)" }} onClick={onPointerNavigate}>
      <style>{NAV_CSS}</style>

      {inDetailFlow ? (
        <>
          {/* Detail-scene layered transition (separate architecture; not a Zoom Region). */}
          <div
            className={`nest-layer ${transitioning ? "nest-locked" : ""} ${nav.transitionState === "entering" ? "nest-out" : ""}`}
            style={{ transformOrigin: origin, animationDuration: `${dur}ms` }}
            aria-hidden={transitioning ? true : undefined}
          >
            <Stage sceneId={nav.currentSceneId} />
          </div>
          {transitioning ? (
            <div
              className={`nest-layer nest-overlay nest-locked ${nav.transitionState === "entering" ? "nest-in" : "nest-back-in"}`}
              style={{ transformOrigin: origin, animationDuration: `${dur}ms` }}
            >
              <Stage sceneId={nav.transitionState === "entering" ? (detailSurfaceIdOf(fa ?? ({} as NestFocusArea)) || main) : main} />
            </div>
          ) : null}
          {!isMain && !transitioning ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[80] flex items-start justify-between p-2.5">
              <button type="button" onClick={() => exitDetail()} aria-label="Back to the main Nest" className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-ink/85 px-3 py-1.5 text-xs font-bold text-parchment shadow-md backdrop-blur hover:bg-ink">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <h2 ref={detailHeadingRef} id={headingId} tabIndex={-1} className="pointer-events-none rounded-full bg-parchment/85 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-ink/70 shadow-sm outline-none backdrop-blur">
                {detailTitle}
              </h2>
            </div>
          ) : null}
        </>
      ) : (
        // ── The ONE Nest viewport: Main + in-place cinematic Zoom Region (same stage) ──
        <CinematicFocusStage
          stage={stageFor(main)}
          assetsById={assetsById}
          interactionsById={interactionsById}
          aspectRatio={doc.aspectRatio}
          focusBounds={zoomFocusBounds}
          childStage={zoomChildSceneId ? stageFor(zoomChildSceneId) : undefined}
          childFa={zoom && !zoomChildSceneId ? zoom.fa : undefined}
          childActive={zoom?.phase === "active"}
          debug={debug}
          reduced={reduced}
          transitionMs={dur}
          focusOverlay={
            zoomActive && zoomChildSceneId ? (
              <InheritedInteractionLayer objects={resolveInheritedFocusObjects(doc, zoomChildSceneId)} mode="preview" debug={debug} />
            ) : null
          }
        >
          {/* Main-Nest read-only projection of child Focus-Scene objects (M7C.8). Behind the
              focus triggers, so a tap on a projected child enters its Focus Area (focus-first). */}
          {!zoomActive ? <ProjectedFocusChildren doc={doc} assetsById={assetsById} mode="visitor" debug={debug} /> : null}

          {/* Main-scene FOCUS-FIRST trigger regions (the rect = focusBounds). Hidden while focused. */}
          {!zoomActive
            ? enabledFocusAreas.map((f, i) => {
                const b = focusBoundsOf(f);
                const hinted = showHint && hint.focusAreaId === f.id;
                return (
                  <button
                    key={f.id}
                    ref={i === 0 ? affordanceRef : undefined}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); enter(f); }}
                    aria-label={f.ariaLabel ?? `${f.previewHint ?? "Explore"} — ${focusTargetTypeOf(f) === "zoom_region" ? "zoom in" : "open close-up"}`}
                    className={`nest-trigger absolute z-[60] rounded-[10px] ${hinted && hint.animated ? "nest-trigger-hint" : ""} ${debug ? "nest-trigger-debug" : ""}`}
                    style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }}
                  >
                    {hinted ? (
                      <span className="nest-trigger-label pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[120%] whitespace-nowrap rounded-full border border-cobalt/25 bg-parchment/95 px-2.5 py-1 text-[11px] font-bold text-cobalt shadow-md backdrop-blur">
                        {f.previewHint ?? "Explore"}
                      </span>
                    ) : null}
                  </button>
                );
              })
            : null}

          {/* Internal debug: the single fixed-ratio focus rectangle. */}
          {debug && !zoomActive
            ? enabledFocusAreas.map((f) => {
                const b = focusBoundsOf(f);
                return (
                  <div key={`dbg-${f.id}`} className="pointer-events-none absolute z-[64] rounded-md border-2 border-solid border-cobalt bg-cobalt/10" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }}>
                    <span className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-t bg-cobalt px-1 py-0.5 text-[8px] font-bold text-white">{f.id} · {focusTargetTypeOf(f)}</span>
                  </div>
                );
              })
            : null}

          {/* Focused chrome — inside the SAME viewport (no modal). */}
          {zoom ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[80] flex items-start justify-between p-2.5" style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); exitZoom(); }} disabled={zoom.phase !== "active"} aria-label="Back to the main Nest" className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-ink/85 px-3 py-1.5 text-xs font-bold text-parchment shadow-md backdrop-blur hover:bg-ink disabled:opacity-60">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <h2 ref={detailHeadingRef} id={headingId} tabIndex={-1} className="pointer-events-none rounded-full bg-parchment/85 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-ink/70 shadow-sm outline-none backdrop-blur">
                {zoom.fa.name}
              </h2>
            </div>
          ) : null}
        </CinematicFocusStage>
      )}
    </div>
  );
}

const NAV_CSS = `
.nest-layer { position: relative; }
.nest-overlay { position: absolute; inset: 0; }
.nest-locked { pointer-events: none; }
@keyframes nest-out { from { transform: scale(1); opacity: 1; } to { transform: scale(1.18); opacity: 0; } }
@keyframes nest-in { from { transform: scale(.86); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes nest-back-in { from { transform: scale(1.12); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.nest-out { animation: nest-out cubic-bezier(.4,0,.2,1) both; }
.nest-in { animation: nest-in cubic-bezier(.22,1,.36,1) both; }
.nest-back-in { animation: nest-back-in cubic-bezier(.22,1,.36,1) both; }
/* Focus-first trigger regions: invisible in presentation, with touch + keyboard feedback. */
.nest-trigger { background: transparent; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; outline: none; }
.nest-trigger:active { background: rgba(43,75,140,.07); }
.nest-trigger:focus-visible { outline: 2px solid rgba(43,75,140,.85); outline-offset: 2px; }
.nest-trigger-debug { outline: 2px dotted rgba(43,75,140,.5); }
@keyframes nest-trigger-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(43,75,140,0); } 50% { box-shadow: 0 0 0 7px rgba(43,75,140,.12); } }
.nest-trigger-hint { animation: nest-trigger-pulse 2.4s ease-in-out 3; }
.nest-trigger-label { animation: nest-fade .5s ease both; }
/* Full-screen focus overlay entrance/exit (fade + gentle scale). */
@keyframes nest-focus-in { from { opacity: 0; transform: scale(1.04); } to { opacity: 1; transform: scale(1); } }
@keyframes nest-focus-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.03); } }
.nest-focus-in { animation: nest-focus-in cubic-bezier(.22,1,.36,1) both; }
.nest-focus-out { animation: nest-focus-out cubic-bezier(.4,0,.2,1) both; }
@media (prefers-reduced-motion: reduce) {
  .nest-out { animation: none; opacity: 0; }
  .nest-in, .nest-back-in { animation: nest-fade both; }
  .nest-trigger-hint { animation: none; }
  .nest-trigger-label { animation: none; }
  .nest-focus-in { animation: nest-fade both; transform: none; }
  .nest-focus-out { animation: nest-fade both; animation-direction: reverse; transform: none; }
}
@keyframes nest-fade { from { opacity: 0; } to { opacity: 1; } }
`;
