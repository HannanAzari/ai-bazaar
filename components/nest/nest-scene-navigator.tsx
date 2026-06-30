"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { GoldenLivingNestStage } from "@/components/nest/golden-living-nest-stage";
import type { Interaction } from "@/lib/nest-types";
import type { LivingNestAsset, LivingNestTemplate } from "@/lib/nest-visual-types";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { editorDocumentToStage } from "@/lib/nest-editor";
import { shapeContainsPoint } from "@/lib/nest-hotspots";
import type { NestFocusArea, NestNavigationState } from "@/lib/nest-focus-types";
import {
  beginEnter,
  beginExit,
  canNavigate,
  focusTransitionDurationMs,
  getDetailScene,
  mainSceneId,
  resolveFocusNavigation,
  settleScene,
} from "@/lib/nest-focus-scenes";

export type { NestNavigationState } from "@/lib/nest-focus-types";

// ── Visitor scene navigator (M7C) ────────────────────────────────────────────
//
// Renders the current scene (Main or Detail) through the EXISTING Golden Living Nest
// stage and manages Main → Focus Area → Detail → Back navigation with a lightweight,
// premium CSS transition (transform + opacity), reduced-motion fallback, interaction
// lock during transitions, browser-back support, and accessible focus management.
// One navigation level (Main → Detail → Main). It is fixture-agnostic: it takes a
// document (main objects + scene graph) + the asset/interaction maps + a base template.

type Props = {
  doc: EditableNestDocument;
  assetsById: Record<string, LivingNestAsset>;
  interactionsById: Record<string, Interaction>;
  baseTemplate: LivingNestTemplate;
  /** Internal: reveal hotspot + focus-area debug overlays (off for visitors). */
  debug?: boolean;
  onSceneChange?: (sceneId: string) => void;
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

/** Whether a scene-normalized point lands on an enabled object hotspot (for tap priority). */
function hotspotHitAt(objects: EditableNestObject[], point: { x: number; y: number }): boolean {
  for (const o of objects) {
    if (o.hidden || o.width <= 0 || o.height <= 0) continue;
    const lx = (point.x - o.x) / o.width;
    const ly = (point.y - o.y) / o.height;
    for (const h of o.hotspots ?? []) {
      if (h.enabled && shapeContainsPoint(h.shape, lx, ly)) return true;
    }
  }
  return false;
}

export function NestSceneNavigator({ doc, assetsById, interactionsById, baseTemplate, debug = false, onSceneChange }: Props) {
  const main = mainSceneId(doc);
  const reduced = usePrefersReducedMotion();
  const dur = focusTransitionDurationMs(reduced);

  const [nav, setNav] = useState<NestNavigationState>({ currentSceneId: main, transitionState: "idle" });
  const lockRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const affordanceRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  // The focus area that leads INTO the current detail scene (for the exit transform origin).
  const enteringFa = useRef<NestFocusArea | undefined>(undefined);

  const enabledFocusAreas = (doc.focusAreas ?? []).filter((f) => f.enabled && f.targetSceneId);

  const finalize = useCallback(
    (sceneId: string) => {
      setNav(settleScene(sceneId));
      lockRef.current = false;
      onSceneChange?.(sceneId);
    },
    [onSceneChange],
  );

  const enter = useCallback(
    (fa: NestFocusArea, pushHistory = true) => {
      if (lockRef.current || !fa.targetSceneId || !getDetailScene(doc, fa.targetSceneId)) return;
      lockRef.current = true;
      enteringFa.current = fa;
      setNav((n) => beginEnter(n));
      if (pushHistory && typeof window !== "undefined") {
        try {
          window.history.pushState({ nestScene: fa.targetSceneId }, "");
        } catch {
          /* history unavailable — navigation still works */
        }
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        finalize(fa.targetSceneId);
        window.setTimeout(() => detailHeadingRef.current?.focus({ preventScroll: true }), 0);
      }, dur);
    },
    [doc, dur, finalize],
  );

  const exit = useCallback(
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
        // Return focus to the affordance that triggered entry, then clear it.
        window.setTimeout(() => affordanceRef.current?.focus({ preventScroll: true }), 0);
        enteringFa.current = undefined;
      }, dur);
    },
    [nav.currentSceneId, main, dur, finalize],
  );

  // Browser back closes a detail scene.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      if (nav.currentSceneId !== main && !lockRef.current) exit(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [nav.currentSceneId, main, exit]);

  // Escape returns from a detail scene.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && nav.currentSceneId !== main && !lockRef.current) {
        e.stopPropagation();
        exit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav.currentSceneId, main, exit]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Double-tap navigation (optional): respects hotspot priority via the pure resolver.
  function onDoubleClick(e: React.MouseEvent) {
    if (!canNavigate(nav) || lockRef.current || nav.currentSceneId !== main) return;
    const sceneEl = (e.target as HTMLElement).closest(".living-scene") as HTMLElement | null;
    if (!sceneEl) return;
    const r = sceneEl.getBoundingClientRect();
    if (r.width <= 0) return;
    const point = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    const res = resolveFocusNavigation({ point, focusAreas: enabledFocusAreas, hotspotHit: hotspotHitAt(doc.objects, point) });
    if (res.kind === "focus") enter(res.focusArea);
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

  return (
    <div ref={rootRef} className="nest-nav relative mx-auto w-full" style={{ maxWidth: "min(94vw, 460px)" }} onDoubleClick={onDoubleClick}>
      <style>{NAV_CSS}</style>

      {/* Base layer = the current scene. During a transition it animates out (entering)
          or is the destination (exiting). */}
      <div
        className={`nest-layer ${transitioning ? "nest-locked" : ""} ${nav.transitionState === "entering" ? "nest-out" : ""}`}
        style={{ transformOrigin: origin, animationDuration: `${dur}ms` }}
        aria-hidden={transitioning ? true : undefined}
      >
        <Stage sceneId={nav.currentSceneId} />
      </div>

      {/* Overlay layer = the incoming scene during a transition. */}
      {transitioning ? (
        <div
          className={`nest-layer nest-overlay nest-locked ${nav.transitionState === "entering" ? "nest-in" : "nest-back-in"}`}
          style={{ transformOrigin: origin, animationDuration: `${dur}ms` }}
        >
          <Stage sceneId={nav.transitionState === "entering" ? (fa?.targetSceneId ?? main) : main} />
        </div>
      ) : null}

      {/* Main-scene Focus Area affordances (subtle, accessible). Hidden during transition. */}
      {isMain && !transitioning
        ? enabledFocusAreas.map((f) => (
            <div key={f.id} className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] flex justify-center p-2.5">
              <button
                ref={f.id === enabledFocusAreas[0]?.id ? affordanceRef : undefined}
                type="button"
                onClick={() => enter(f)}
                aria-label={f.ariaLabel ?? `${f.previewHint ?? "Explore"} — open detail scene`}
                className="nest-affordance pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-cobalt/30 bg-parchment/95 px-3.5 py-1.5 text-xs font-bold text-cobalt shadow-md backdrop-blur"
              >
                <span className="nest-affordance-dot" aria-hidden />
                {f.previewHint ?? "Explore"}
              </button>
            </div>
          ))
        : null}

      {/* Internal debug: reveal Focus Area bounds on the main scene. */}
      {debug && isMain
        ? enabledFocusAreas.map((f) => (
            <div
              key={`dbg-${f.id}`}
              className={`pointer-events-none absolute z-[65] border-2 border-dashed border-cobalt/70 bg-cobalt/10 ${f.shape === "ellipse" ? "rounded-full" : "rounded-md"}`}
              style={{ left: `${f.bounds.x * 100}%`, top: `${f.bounds.y * 100}%`, width: `${f.bounds.width * 100}%`, height: `${f.bounds.height * 100}%` }}
            >
              <span className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded-t bg-cobalt px-1 py-0.5 text-[8px] font-bold text-white">
                {f.id} → {f.targetSceneId} · {f.trigger}/{f.transition}
              </span>
            </div>
          ))
        : null}

      {/* Detail-scene chrome: compact Back + parent breadcrumb + title. */}
      {!isMain ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[70] flex items-start justify-between p-2.5">
          <button
            type="button"
            onClick={() => exit()}
            disabled={transitioning}
            aria-label="Back to the main Nest"
            className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-ink/85 px-3 py-1.5 text-xs font-bold text-parchment shadow-md backdrop-blur hover:bg-ink"
          >
            <ChevronLeft className="h-4 w-4" /> {baseTemplate.name.split(" ").slice(-1)[0] === "Nest" ? "Nest" : "Living Room"}
          </button>
          <h2 ref={detailHeadingRef} id={headingId} tabIndex={-1} className="pointer-events-none rounded-full bg-parchment/85 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-ink/70 shadow-sm outline-none backdrop-blur">
            {detailTitle}
          </h2>
        </div>
      ) : null}
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
@keyframes nest-affordance-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(43,75,140,.0); } 50% { box-shadow: 0 0 0 6px rgba(43,75,140,.12); } }
.nest-affordance { animation: nest-affordance-pulse 2.4s ease-in-out 3; }
.nest-affordance-dot { width: 6px; height: 6px; border-radius: 9999px; background: currentColor; opacity: .8; }
@media (prefers-reduced-motion: reduce) {
  .nest-out { animation: none; opacity: 0; }
  .nest-in, .nest-back-in { animation: nest-fade both; }
  .nest-affordance { animation: none; }
}
@keyframes nest-fade { from { opacity: 0; } to { opacity: 1; } }
`;
