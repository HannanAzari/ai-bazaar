"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FlipHorizontal2,
  Link2,
  Layers,
  Lock,
  RotateCw,
  Trash2,
  Unlock,
} from "lucide-react";
import type { NestAmbiencePreset, NormalizedRect } from "@/lib/nest-types";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import { aspectRatioCss } from "@/lib/nest-render";
import type { EditableNestDocument, EditableNestObject } from "@/lib/nest-editor-types";
import { moveObject, resizeObject, rotateObject, type ReorderOp } from "@/lib/nest-editor";
import { canFlipObject, canRotateObject, snapRotation } from "@/lib/nest-editor-policy";
import { OverlayContent } from "@/components/nest/overlay-content";
import type { NestAssetHotspot } from "@/lib/nest-hotspot-types";
import { isInternalSemantic as hsInternal } from "@/lib/nest-hotspot-types";
import { moveHotspot, resizeHotspot } from "@/lib/nest-hotspots";
import { visibleRect } from "@/lib/nest-visual-bounds";
import { computeAlignment, type AlignGuide } from "@/lib/nest-align";
import { hitTestCandidates, nextSelection, type TapCycleState } from "@/lib/nest-editor-hit-testing";
import { EDITOR_TOUCH_TARGETS } from "@/lib/nest-editor-touch-targets";
import { contextToolbarPlacement, type ToolbarPlacement } from "@/lib/nest-editor-toolbar";
import { useSceneCamera } from "@/components/nest/app-shell/use-scene-camera";
import { z } from "@/lib/nest-layers";
import { beginGesture, classifyTarget, gestureAllows, ownerMovesCamera, resolveGestureOwner, upgradeGesture, type ActiveGesture } from "@/lib/nest-gesture";
import { capabilitiesForAsset } from "@/lib/nest-asset-interaction";
import { visibleSceneCentre } from "@/lib/nest-camera";
import { ScreenSpaceSelection } from "@/components/nest/editor/screen-space-selection";
import { Maximize2 } from "lucide-react";
import { resolveObjectSurfaces } from "@/lib/nest-surfaces";
import { SurfaceContentLayer } from "@/components/nest/surface-content-layer";

// The mobile editor canvas (Arrange mode). Pointer Events drive a unified gesture
// model — one finger moves, two fingers pinch-resize + twist-rotate (when policy
// allows), with corner handles + a rotation handle as accessible fallbacks. The
// selected object gets a polished transform frame and a compact contextual action
// bar. A viewport zoom scales the authoring view only — never the placement data.
// `touch-action: none` stops page scroll/zoom inside the canvas. One history entry
// is committed per completed gesture (at the final pointer-up). Editor chrome lives
// only here — Preview renders via the real stage with no chrome.

type Props = {
  doc: EditableNestDocument;
  assetsById: Record<string, LivingNestAsset>;
  ambience?: NestAmbiencePreset;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onCommit: (next: EditableNestDocument) => void;
  showGrid: boolean;
  snap: boolean;
  advanced: boolean;
  zoom: number;
  /** M25B §P2 — an object sheet is open: hide the floating toolbar entirely. */
  hideChrome?: boolean;
  /** M26A §6 — hand the host a way to ask where the creator is currently looking. */
  onVisibleCentreRef?: (get: () => { nx: number; ny: number }) => void;
  gridCols?: number;
  gridRows?: number;
  onDuplicate: () => void;
  onReorder: (op: ReorderOp) => void;
  onFlip: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  /** M26 §P3 — Connect is contextual: it appears only on an asset that takes content. */
  onConnect?: () => void;
  /** Connect mode: select assets + their hotspots; arrange gestures are disabled. */
  connect?: boolean;
  selectedHotspotId?: string;
  onSelectHotspot?: (id: string | undefined) => void;
  /** Advanced authoring: show hotspot move/resize handles. */
  hotspotAuthoring?: boolean;
  onHotspotsCommit?: (hotspots: NestAssetHotspot[]) => void;
  /** M7C.7: a custom (read-only) background layer — the transformed parent-crop base for a
   *  child Focus Scene. When set it REPLACES the flat `backgroundImageUrl` image, so the
   *  child editor is authored over the exact parent crop the visitor sees. */
  backgroundNode?: React.ReactNode;
  /** M7C.8: a read-only overlay above the objects, below the authoring chrome — used for
   *  Main-Nest projections of child objects, and for inherited interaction proxies. */
  foregroundNode?: React.ReactNode;
  /** M8 Surface mode: select-only (no move/resize); tapping the selected object's surface
   *  regions opens the surface editor. */
  surface?: boolean;
  selectedSurfaceId?: string;
  onSelectSurface?: (id: string | undefined) => void;
};

type Gesture =
  | { kind: "move"; id: string; startNX: number; startNY: number }
  | { kind: "resize"; id: string; dirX: number; startNX: number; startW: number }
  | { kind: "rotate"; id: string; cx: number; cy: number; startAngle: number; startRot: number }

type Pt = { x: number; y: number };

const pctOf = (n: number) => `${+(n * 100).toFixed(3)}%`;
/** Constant gap (px) the rotate handle sits above the selection frame. */
const snapStep = (v: number, step: number) => Math.round(v / step) * step;
const angle = (a: Pt, b: Pt) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const transformOf = (o: EditableNestObject) =>
  `${o.rotation ? `rotate(${o.rotation}deg)` : ""}${o.flipX ? " scaleX(-1)" : ""}`.trim();

export function EditorCanvas(props: Props) {
  const { doc, assetsById, ambience, selectedId, onSelect, onCommit, showGrid, snap, advanced, zoom, hideChrome, gridCols = 24, gridRows = 32 } = props;
  const connect = props.connect ?? false;
  const sceneRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, Pt>>(new Map());
  const gestureRef = useRef<Gesture | null>(null);
  // ── M26A-final — ONE dispatcher ──────────────────────────────────────────
  //
  // The locked owner of the current pointer session. Assigned once at pointer-down and
  // never re-decided; `gestureRef` is only ever the MECHANICS of whatever this owner does.
  // Before this, the canvas and the camera each decided independently on every move, which
  // is how a drag could move an object and pan the room in the same frame.
  const ownerRef = useRef<ActiveGesture | null>(null);
  const guidesRef = useRef<AlignGuide[]>([]);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [layerOpen, setLayerOpen] = useState(false);
  // Overlap selection (Phase 1) + long-press layer picker (Phase 2).
  const tapCycle = useRef<TapCycleState | undefined>(undefined);
  const longPress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const downClient = useRef<Pt | null>(null);
  const didMove = useRef(false);
  const [picker, setPicker] = useState<{ nx: number; ny: number; ids: string[] } | null>(null);

  const toNorm = (clientX: number, clientY: number) => {
    const r = sceneRef.current!.getBoundingClientRect();
    return { nx: (clientX - r.left) / r.width, ny: (clientY - r.top) / r.height };
  };
  const sceneSize = () => {
    const r = sceneRef.current?.getBoundingClientRect();
    return r && r.width > 0 ? { width: r.width, height: r.height } : undefined;
  };
  const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  // Reset the overlap tap-cycle + close the layer picker whenever the mode changes.
  useEffect(() => {
    tapCycle.current = undefined;
    setPicker(null);
  }, [connect]);

  // Live (preview) document while a gesture is active; never commits history.
  const liveDoc: EditableNestDocument = (() => {
    const g = gestureRef.current;
    if (!g) return doc;
    const pts = Array.from(pointers.current.values());
    if (g.kind === "move" && pts[0]) {
      const { nx, ny } = toNorm(pts[0].x, pts[0].y);
      const o0 = doc.objects.find((o) => o.instanceId === g.id)!;
      let dx = nx - g.startNX;
      let dy = ny - g.startNY;
      if (snap) {
        // Advanced grid snap.
        dx = snapStep(o0.x + dx, 1 / gridCols) - o0.x;
        dy = snapStep(o0.y + dy, 1 / gridRows) - o0.y;
        guidesRef.current = [];
      } else {
        // Smart alignment: snap the moving object's VISIBLE rect to canvas/other-object
        // alignments; surface transient guides. Deterministic.
        const movedVis = visibleRect({ x: o0.x + dx, y: o0.y + dy, width: o0.width, height: o0.height }, o0.assetId);
        const targets = doc.objects
          .filter((o) => o.instanceId !== g.id && !o.hidden)
          .map((o) => ({ rect: visibleRect(o, o.assetId) }));
        const al = computeAlignment(movedVis, targets);
        guidesRef.current = al.guides;
        dx += al.snap.dx;
        dy += al.snap.dy;
      }
      return moveObject(doc, g.id, dx, dy, assetsById);
    }
    if (g.kind === "resize" && pts[0]) {
      const { nx } = toNorm(pts[0].x, pts[0].y);
      let w = g.startW + g.dirX * (nx - g.startNX) * 2;
      if (snap) w = snapStep(w, 1 / gridCols);
      return resizeObject(doc, g.id, w, assetsById);
    }
    if (g.kind === "rotate" && pts[0]) {
      const { nx, ny } = toNorm(pts[0].x, pts[0].y);
      let rot = g.startRot + (angle({ x: g.cx, y: g.cy }, { x: nx, y: ny }) - g.startAngle);
      if (snap) rot = snapRotation(rot, 6);
      return rotateObject(doc, g.id, rot, assetsById);
    }
    return doc;
  })();

  const objects = [...liveDoc.objects].sort((a, b) => a.zIndex - b.zIndex);
  const selected = selectedId ? liveDoc.objects.find((o) => o.instanceId === selectedId) : undefined;
  const selectedAsset = selected ? assetsById[selected.assetId] : undefined;

  function capture(e: React.PointerEvent) {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture unavailable — gesture still works */
    }
  }
  function commit() {
    ownerRef.current = null;
    if (gestureRef.current) {
      // A plain tap (no drag) must not pollute history — only a real gesture commits.
      if (didMove.current) onCommit(liveDoc);
      gestureRef.current = null;
      guidesRef.current = []; // alignment guides vanish the moment the gesture ends
      rerender();
    }
  }

  // Overlap-aware selection: pick from ALL objects under the pointer (visible bounds +
  // min tap target), cycling on repeated taps near the same point. Returns the chosen id.
  function selectAtPoint(e: React.PointerEvent, fallback: EditableNestObject): string {
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    const point = { x: nx, y: ny };
    const candidates = hitTestCandidates(liveDoc.objects, assetsById, point, { scene: sceneSize() });
    const res = nextSelection(tapCycle.current, candidates, point, nowMs());
    tapCycle.current = res.state;
    const id = res.selectedId ?? fallback.instanceId;
    onSelect(id);
    return id;
  }

  // Long-press → open the layer picker when ≥2 objects overlap the point.
  function armLongPress(nx: number, ny: number) {
    clearTimeout(longPress.current);
    longPress.current = setTimeout(() => {
      const candidates = hitTestCandidates(liveDoc.objects, assetsById, { x: nx, y: ny }, { scene: sceneSize() });
      if (candidates.length >= 2) {
        gestureRef.current = null; // cancel any pending move so the picker takes over
        pointers.current.clear();
        didMove.current = false;
        setPicker({ nx, ny, ids: candidates.map((c) => c.objectId) });
        rerender();
      }
    }, 450);
  }

  function onObjectDown(e: React.PointerEvent, o: EditableNestObject) {
    const id = selectAtPoint(e, o);
    setLayerOpen(false);
    setPicker(null);
    const sel = liveDoc.objects.find((x) => x.instanceId === id) ?? o;
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    downClient.current = { x: e.clientX, y: e.clientY };
    didMove.current = false;
    armLongPress(nx, ny);
    // Connect / Surface mode: tapping an asset only selects it — never moves it.
    if (connect || props.surface) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (sel.locked) return;
    e.preventDefault();
    capture(e);
    const pts = Array.from(pointers.current.values());
    // M26A-final: a second finger on an object is a CAMERA PINCH, not an object resize.
    // The old code resized and rotated the object from a two-finger gesture, so pinching
    // to look closer silently rewrote the creator's geometry.
    if (pts.length >= 2) {
      ownerRef.current = ownerRef.current ? upgradeGesture(ownerRef.current, pts.length) : null;
      gestureRef.current = null;
      rerender();
      return;
    }
    ownerRef.current = beginGesture(
      { pointerCount: 1, target: sel.instanceId === selectedId ? "selected-object" : "other-object", scale: camScaleRef.current, objectId: sel.instanceId, locked: sel.locked },
      e.pointerId,
    );
    // `select` still arms a move: the drag threshold in onPointerMove decides whether it
    // ever becomes one, so a tap selects and a drag moves, from the same gesture.
    gestureRef.current = { kind: "move", id: sel.instanceId, startNX: nx, startNY: ny };
    rerender();
  }

  function onHandleDown(e: React.PointerEvent, o: EditableNestObject, kind: "resize" | "rotate", dirX = 1) {
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(longPress.current);
    didMove.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    capture(e);
    ownerRef.current = beginGesture(
      { pointerCount: 1, target: kind === "resize" ? "resize-handle" : "rotate-handle", scale: camScaleRef.current, objectId: o.instanceId, locked: o.locked },
      e.pointerId,
    );
    if (kind === "resize") {
      const { nx } = toNorm(e.clientX, e.clientY);
      gestureRef.current = { kind: "resize", id: o.instanceId, dirX, startNX: nx, startW: o.width };
    } else {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const { nx, ny } = toNorm(e.clientX, e.clientY);
      gestureRef.current = { kind: "rotate", id: o.instanceId, cx, cy, startAngle: angle({ x: cx, y: cy }, { x: nx, y: ny }), startRot: o.rotation ?? 0 };
    }
    rerender();
  }

  function onPointerMove(e: React.PointerEvent) {
    // Cancel a pending long-press once the pointer travels (it's a drag, not a press).
    if (downClient.current) {
      const moved = Math.hypot(e.clientX - downClient.current.x, e.clientY - downClient.current.y);
      if (moved > 8) clearTimeout(longPress.current);
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (!g) return;
    // The owner decided at pointer-down is the ONLY thing allowed to act.
    const owner = ownerRef.current;
    const wanted = g.kind === "move" ? "object-move" : g.kind === "resize" ? "object-resize" : "object-rotate";
    if (!gestureAllows(owner, wanted)) return;
    e.preventDefault();
    didMove.current = true;
    const pts = Array.from(pointers.current.values());
    if (pts.length >= 2) {
      // A second finger mid-drag is a camera pinch. The object is ABANDONED exactly where
      // it is — not resized, not rotated, not snapped back — and the camera takes over.
      ownerRef.current = upgradeGesture(ownerRef.current!, pts.length);
      gestureRef.current = null;
    }
    rerender();
  }

  function onPointerUp(e: React.PointerEvent) {
    clearTimeout(longPress.current);
    downClient.current = null;
    pointers.current.delete(e.pointerId);
    if (gestureRef.current && pointers.current.size === 0) commit();
    else rerender();
  }

  // Open the overlap picker from the contextual "Layer → Select object" action,
  // centred on the selected object's centre (reuses the same component as long-press).
  function openLayerPickerForSelected() {
    if (!selected) return;
    const nx = selected.x + selected.width / 2;
    const ny = selected.y + selected.height / 2;
    const candidates = hitTestCandidates(liveDoc.objects, assetsById, { x: nx, y: ny }, { scene: sceneSize() });
    setLayerOpen(false);
    setPicker({ nx, ny, ids: (candidates.length ? candidates : [{ objectId: selected.instanceId }]).map((c) => c.objectId) });
  }

  // M25B §P1 — the shared camera. A one-finger drag that starts ON AN ASSET moves the
  // asset; anywhere else it pans (once zoomed). Two fingers always pinch.
  // ── M26A §4 — deterministic gesture ownership ────────────────────────────
  //
  // ROOT CAUSE of "the camera steals object drags": this used to ask only whether the
  // pointer was inside `[data-editor-object]`. Resize and rotation handles are rendered
  // OUTSIDE the object element (they have to be — they belong to the selection frame, not
  // the object), so a drag that began on a handle passed the filter and panned the room
  // instead of resizing. Ownership is now resolved once, at pointer-down, by the shared
  // arbiter, and the camera only ever claims a gesture the arbiter gave it.
  const camera = useSceneCamera({
    canPanFrom: (target) => {
      const el = target instanceof Element ? target : null;
      const { target: kind, objectId, locked } = classifyTarget(
        (sel) => {
          const hit = el?.closest(sel) as HTMLElement | null;
          if (!hit) return null;
          return { id: hit.dataset.editorObject, locked: hit.dataset.locked === "1" };
        },
        selectedId,
      );
      return ownerMovesCamera(resolveGestureOwner({ pointerCount: 1, target: kind, scale: camScaleRef.current, objectId, locked }));
    },
  });
  // The arbiter needs the scale at pointer-down without re-rendering on every frame.
  const camScaleRef = useRef(1);
  useEffect(
    () =>
      camera.subscribe((c) => {
        camScaleRef.current = c.scale;
        const sr = sceneRef.current?.getBoundingClientRect();
        if (sr && c.scale > 0) baseSizeRef.current = { width: sr.width / c.scale, height: sr.height / c.scale };
        // The object toolbar still counter-scales through this variable; the selection
        // frame and its handles no longer need it — they are real screen-space siblings.
        rootRef.current?.style.setProperty("--nest-inv-scale", String(1 / c.scale));
      }),
    [camera],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  // The UNTRANSFORMED stage size. `sceneToScreen` needs it, and the only honest source is
  // the live element divided by the scale it is currently drawn at.
  const baseSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  // M26A §6 — the host asks "where can the creator currently see?" before adding an asset.
  useEffect(() => {
    props.onVisibleCentreRef?.(() => {
      const el = rootRef.current;
      const scene = sceneRef.current;
      if (!el || !scene) return { nx: 0.5, ny: 0.5 };
      const vr = el.getBoundingClientRect();
      const cam = camera.read();
      // The UNTRANSFORMED stage size = the current visual size divided by the scale.
      const sr = scene.getBoundingClientRect();
      const base = { width: sr.width / cam.scale, height: sr.height / cam.scale };
      return visibleSceneCentre(cam, { left: vr.left, top: vr.top, width: vr.width, height: vr.height }, base);
    });
  }, [camera, props]);

  // Contextual toolbar placement (M7C.9): anchor to the VISIBLE rect and pick a side that
  // never covers the resize/rotation handles (rotation handle sits above small assets).
  const selectedVr = selected ? visibleRect(selected, selected.assetId) : undefined;
  const barPlacement: ToolbarPlacement = (() => {
    if (!selected || !selectedVr) return { side: "above", offsetPx: 8 };
    const ss = sceneSize();
    const rotatable = canRotateObject(selected, selectedAsset) && !selected.locked;
    if (!ss || ss.height <= 0) {
      // Pre-layout fallback: keep the historical heuristic but clear the rotation handle.
      return { side: selected.y > 0.16 ? "above" : "below", offsetPx: rotatable ? 70 : 8 };
    }
    return contextToolbarPlacement({
      topPx: selectedVr.y * ss.height,
      bottomPx: (selectedVr.y + selectedVr.height) * ss.height,
      sceneHeightPx: ss.height,
      hasRotateHandle: rotatable,
    });
  })();

  return (
    // ── M25B §P1 — the creator gets the SAME camera as the visitor ───────────
    //
    // `useSceneCamera` is reused verbatim: same 1–5× limits, same focal-point pinch, same
    // pan clamping, same tap-vs-drag classification. There is no second zoom system.
    //
    // The reason this needs almost no coordinate work: `toNorm()` converts a client point
    // with `sceneRef.getBoundingClientRect()`, and a transformed element's bounding rect is
    // its POST-transform box. So `(clientX - r.left) / r.width` is already a canonical
    // scene coordinate at any scale — dragging, resizing and dropping a new asset are
    // correct at 5× for the same reason they are correct at 1×, with no scale term
    // anywhere. Camera state therefore never reaches object geometry, and never reaches
    // the document (D-45).
    <div
      ref={(el) => { camera.viewportRef.current = el; rootRef.current = el; }}
      className="relative flex h-full w-full items-center justify-center overflow-hidden p-2"
      style={{ touchAction: "none", "--nest-inv-scale": 1 } as React.CSSProperties}
    >
      <style>{CANVAS_CSS}</style>
      {camera.zoomed && !hideChrome ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={camera.reset}
          aria-label="Reset the view"
          data-editor-chrome=""
          className={`absolute right-3 top-3 ${z.chrome} inline-flex touch-manipulation items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-parchment shadow-lg backdrop-blur transition active:scale-95`}
        >
          <Maximize2 className="h-3.5 w-3.5" /> Reset view
        </button>
      ) : null}
      {/* Aspect-locked fit: an oversized base clamped by both max-dimensions keeps the
          scene a true 3:4 (full room visible, including side walls) regardless of the
          viewport shape. Zoom scales both clamps. */}
      <div ref={camera.stageRef} className="relative will-change-transform" style={{ width: "9999px", aspectRatio: aspectRatioCss(doc.aspectRatio as "3:4"), maxWidth: `${Math.round(96 * zoom)}%`, maxHeight: `${Math.round(100 * zoom)}%` }}>
        <div
          ref={sceneRef}
          className="editor-scene absolute inset-0 isolate touch-none select-none overflow-hidden rounded-[24px] border border-ink/10 shadow-xl"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg === "1") {
              onSelect(undefined);
              setLayerOpen(false);
              setPicker(null);
              tapCycle.current = undefined;
            }
          }}
        >
          {props.backgroundNode ? (
            // Transformed parent-crop base (child Focus Scene). pointer-events-none so taps on
            // empty space fall through to the scene container and clear the selection.
            <div data-bg="1" aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">{props.backgroundNode}</div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.backgroundImageUrl} alt="" data-bg="1" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          )}
          {ambience ? <div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ backgroundColor: ambience.tint, opacity: Math.min(0.45, ambience.intensity) }} aria-hidden /> : null}
          {showGrid ? <GridGuides cols={gridCols} rows={gridRows} /> : null}
          {gestureRef.current && guidesRef.current.length ? <AlignGuides guides={guidesRef.current} /> : null}

          {objects.map((o) => {
            if (o.hidden) return null;
            const asset = assetsById[o.assetId];
            const floor = o.plane === "floor" || o.plane === "foreground";
            const t = transformOf(o);
            return (
              <button
                key={o.instanceId}
                type="button"
                className="editor-piece absolute touch-none"
                data-editor-object={o.instanceId}
                data-locked={o.locked ? "1" : undefined}
                style={{ left: pctOf(o.x), top: pctOf(o.y), width: pctOf(o.width), height: pctOf(o.height), zIndex: o.zIndex, transform: t || undefined, transformOrigin: "center" }}
                onPointerDown={(e) => onObjectDown(e, o)}
                aria-label={`${o.overlay ? (o.overlay.kind === "text" ? `Text: ${o.overlay.text}` : "Image sticker") : asset?.name ?? o.assetId}${o.locked ? " (locked)" : ""}`}
              >
                {o.contactShadow ? <div className="editor-contact-shadow" aria-hidden /> : null}
                {o.overlay ? (
                  <OverlayContent overlay={o.overlay} />
                ) : asset?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.imageUrl} alt="" draggable={false} className={`pointer-events-none h-full w-full object-contain ${floor ? "object-bottom" : "object-center"}`} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded border border-terracotta/50 bg-terracotta/10 text-[9px] font-bold text-ink/60">{o.assetId}</div>
                )}
                {/* M8: editable-surface content (photo/text/sticker), clipped to the region. */}
                <SurfaceContentLayer surfaces={resolveObjectSurfaces(o)} />
              </button>
            );
          })}

          {/* Read-only foreground overlay (M7C.8: Main projections / inherited proxies). */}
          {props.foregroundNode}

          {/* M8 Surface mode: tappable surface regions on the selected object. */}
          {props.surface && selected && !selected.hidden ? (
            <SurfaceHighlightLayer object={selected} selectedSurfaceId={props.selectedSurfaceId} onSelect={(id) => props.onSelectSurface?.(id)} />
          ) : null}

          {/* M26A-completion §2 — the selection frame is NO LONGER here. It lives in the
              screen-space sibling layer below, outside the camera transform, so it neither
              scales with the room nor gets clipped by the scene's overflow. */}

          {/* Transient rotation degree label while rotating/pinching a rotatable object. */}
          {!connect && selected && gestureRef.current?.kind === "rotate" && selected.rotation != null ? (
            <div className="pointer-events-none absolute z-[510] -translate-x-1/2 rounded-full bg-ink/90 px-2 py-0.5 text-[11px] font-bold text-parchment" style={{ left: pctOf(selected.x + selected.width / 2), top: pctOf(Math.max(0.02, selected.y - 0.03)) }}>
              {Math.round(selected.rotation)}°
            </div>
          ) : null}

          {/* Connect-mode hotspot overlay for the selected asset */}
          {connect && selected && !selected.hidden ? (
            <HotspotLayer
              key={selected.instanceId}
              object={selected}
              sceneRef={sceneRef}
              hotspots={selected.hotspots ?? []}
              selectedHotspotId={props.selectedHotspotId}
              authoring={Boolean(props.hotspotAuthoring)}
              onSelectHotspot={(id) => props.onSelectHotspot?.(id)}
              onCommit={(hs) => props.onHotspotsCommit?.(hs)}
            />
          ) : null}
        </div>
      </div>

      {/* ── SCREEN SPACE ────────────────────────────────────────────────────────
          A sibling of the transformed stage, never a descendant. Everything in here is
          positioned in screen pixels and repositioned from `sceneToScreen()` inside the
          camera's own frame. */}
      {!connect && !props.surface && !hideChrome && selected && !selected.hidden ? (
        <ScreenSpaceSelection
          key={selected.instanceId}
          object={selected}
          rect={visibleRect(selected, selected.assetId)}
          subscribe={camera.subscribe}
          viewportRef={rootRef}
          baseSizeRef={baseSizeRef}
          onHandleDown={onHandleDown}
          rotatable={canRotateObject(selected, selectedAsset)}
          toolbar={
            <ContextBar o={selected} asset={selectedAsset} layerOpen={layerOpen} setLayerOpen={setLayerOpen} onDuplicate={props.onDuplicate} onReorder={props.onReorder} onFlip={props.onFlip} onToggleLock={props.onToggleLock} onDelete={props.onDelete} onConnect={props.onConnect} onOpenLayerPicker={openLayerPickerForSelected} />
          }
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0">
        {/* Long-press / Layer → overlap object picker (Phase 2) */}
        {picker ? (
          <LayerPicker
            nx={picker.nx}
            ny={picker.ny}
            ids={picker.ids}
            objects={liveDoc.objects}
            assetsById={assetsById}
            selectedId={selectedId}
            onPick={(id) => {
              onSelect(id);
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Hotspot overlay (Connect mode) ───────────────────────────────────────────
// Renders the selected asset's hotspots in asset-local space (inside the object's
// transformed box, so they follow rotation/flip). Tapping a region selects it; in
// authoring mode the selected region gets a move body + corner resize handles. Drag
// math is computed in the object's local frame (best on un-rotated assets).
function HotspotLayer({
  object,
  sceneRef,
  hotspots,
  selectedHotspotId,
  authoring,
  onSelectHotspot,
  onCommit,
}: {
  object: EditableNestObject;
  sceneRef: React.RefObject<HTMLDivElement | null>;
  hotspots: NestAssetHotspot[];
  selectedHotspotId?: string;
  authoring: boolean;
  onSelectHotspot: (id: string | undefined) => void;
  onCommit: (hotspots: NestAssetHotspot[]) => void;
}) {
  const gestureRef = useRef<
    | { kind: "move"; id: string; startLX: number; startLY: number }
    | { kind: "resize"; id: string; dirX: number; dirY: number; startLX: number; startLY: number; w0: number; h0: number }
    | null
  >(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const toLocal = (clientX: number, clientY: number) => {
    const r = sceneRef.current!.getBoundingClientRect();
    const nx = (clientX - r.left) / r.width;
    const ny = (clientY - r.top) / r.height;
    return { lx: (nx - object.x) / object.width, ly: (ny - object.y) / object.height };
  };

  // Compute the live geometry for the dragged hotspot from the last pointer.
  const lastPt = useRef<{ lx: number; ly: number } | null>(null);
  function liveHotspots(): NestAssetHotspot[] {
    const g = gestureRef.current;
    const p = lastPt.current;
    if (!g || !p) return hotspots;
    if (g.kind === "move") {
      return moveHotspot(hotspots, g.id, p.lx - g.startLX, p.ly - g.startLY);
    }
    const w = g.w0 + g.dirX * (p.lx - g.startLX) * (g.dirX === 0 ? 0 : 2);
    const h = g.h0 + g.dirY * (p.ly - g.startLY) * (g.dirY === 0 ? 0 : 2);
    return resizeHotspot(hotspots, g.id, w, h);
  }

  function startMove(e: React.PointerEvent, h: NestAssetHotspot) {
    onSelectHotspot(h.id);
    if (!authoring || h.locked) return;
    e.preventDefault();
    e.stopPropagation();
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ok */ }
    const { lx, ly } = toLocal(e.clientX, e.clientY);
    gestureRef.current = { kind: "move", id: h.id, startLX: lx, startLY: ly };
    lastPt.current = { lx, ly };
    rerender();
  }
  function startResize(e: React.PointerEvent, h: NestAssetHotspot, dirX: number, dirY: number) {
    e.preventDefault();
    e.stopPropagation();
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ok */ }
    const { lx, ly } = toLocal(e.clientX, e.clientY);
    gestureRef.current = { kind: "resize", id: h.id, dirX, dirY, startLX: lx, startLY: ly, w0: h.shape.width, h0: h.shape.height };
    lastPt.current = { lx, ly };
    rerender();
  }
  function onMove(e: React.PointerEvent) {
    if (!gestureRef.current) return;
    e.preventDefault();
    lastPt.current = toLocal(e.clientX, e.clientY);
    rerender();
  }
  function onUp() {
    if (gestureRef.current) {
      onCommit(liveHotspots());
      gestureRef.current = null;
      lastPt.current = null;
      rerender();
    }
  }

  const display = gestureRef.current ? liveHotspots() : hotspots;
  const t = transformOf(object);
  return (
    <div
      className="absolute z-[520]"
      style={{ left: pctOf(object.x), top: pctOf(object.y), width: pctOf(object.width), height: pctOf(object.height), transform: t || undefined, transformOrigin: "center" }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {display.map((h) => {
        const sel = h.id === selectedHotspotId;
        const ellipse = h.shape.type === "ellipse";
        // State-driven styling (subtle when unselected, clear when selected).
        const connected = Boolean(h.binding?.url) || hsInternal(h.semantic);
        const cls = !h.enabled
          ? "border border-dotted border-ink/30 bg-ink/[0.03]"
          : sel
            ? "border-2 border-teal bg-teal/15"
            : connected
              ? "border border-meadow-shade/70 bg-meadow/[0.06]"
              : "border border-dashed border-teal/45";
        return (
          <div key={h.id} className="absolute" style={{ left: pctOf(h.shape.x), top: pctOf(h.shape.y), width: pctOf(h.shape.width), height: pctOf(h.shape.height) }}>
            <button
              type="button"
              onPointerDown={(e) => startMove(e, h)}
              aria-label={`Hotspot ${h.name}${sel ? " (selected)" : ""}`}
              className={`absolute inset-0 touch-none ${ellipse ? "rounded-full" : "rounded-[6px]"} ${cls}`}
            >
              {sel ? <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-teal px-1.5 py-0.5 text-[8px] font-bold text-white">{h.name}</span> : null}
            </button>
            {sel && authoring && !h.locked
              ? ([
                  [0, 0, -1, -1],
                  [1, 0, 1, -1],
                  [0, 1, -1, 1],
                  [1, 1, 1, 1],
                ] as const).map(([cx, cy, dx, dy]) => (
                  <span key={`${cx}-${cy}`} className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none items-center justify-center" style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }} onPointerDown={(e) => startResize(e, h, dx, dy)}>
                    <span className="h-3 w-3 rounded-full border-2 border-teal bg-white shadow" />
                  </span>
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}

// ── Surface highlight layer (M8 Surface mode) ────────────────────────────────
// Tappable outlines of the selected object's editable surface regions (asset-local),
// following the object's transform. Tapping one opens the surface editor. No move/resize.
function SurfaceHighlightLayer({ object, selectedSurfaceId, onSelect }: { object: EditableNestObject; selectedSurfaceId?: string; onSelect: (id: string | undefined) => void }) {
  const surfaces = resolveObjectSurfaces(object);
  if (surfaces.length === 0) return null;
  const t = transformOf(object);
  return (
    <div className="absolute z-[520]" style={{ left: pctOf(object.x), top: pctOf(object.y), width: pctOf(object.width), height: pctOf(object.height), transform: t || undefined, transformOrigin: "center" }}>
      {surfaces.map((s) => {
        const sel = s.id === selectedSurfaceId;
        return (
          <button
            key={s.id}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSelect(s.id); }}
            aria-label={`Edit ${s.name} surface`}
            className={`absolute touch-none rounded-[5px] ${sel ? "border-2 border-saffron bg-saffron/20" : "border border-dashed border-saffron/70 bg-saffron/[0.08]"}`}
            style={{ left: pctOf(s.bounds.x), top: pctOf(s.bounds.y), width: pctOf(s.bounds.width), height: pctOf(s.bounds.height) }}
          >
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-saffron px-1.5 py-0.5 text-[8px] font-bold text-ink">{s.name}{s.content ? " ✓" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}


function ContextBar({ o, asset, layerOpen, setLayerOpen, onDuplicate, onReorder, onFlip, onToggleLock, onDelete, onConnect, onOpenLayerPicker }: { o: EditableNestObject; asset?: LivingNestAsset; layerOpen: boolean; setLayerOpen: (v: boolean) => void; onDuplicate: () => void; onReorder: (op: ReorderOp) => void; onFlip: () => void; onToggleLock: () => void; onDelete: () => void; onConnect?: () => void; onOpenLayerPicker: () => void }) {
  // M26A-final: the bar no longer positions ITSELF. It is a child of the screen-space
  // selection frame, which is already tracked in screen pixels — so the bar inherits the
  // right place automatically and needs no transform, no percentage of the scene and no
  // counter-scale. (Counter-scaling it here while it sat in screen space is what shrank it
  // 5× — a double negative that measurement caught.)
  const flippable = canFlipObject(o, asset);
  return (
    <div className={`pointer-events-none ${z.chrome} flex justify-center`}>
      <div className="pointer-events-auto relative flex items-center gap-0.5 rounded-full border border-ink/10 bg-parchment/95 p-1 shadow-lg backdrop-blur">
        <CtxBtn label="Duplicate" onClick={onDuplicate}><Copy className="h-4 w-4" /></CtxBtn>
        <CtxBtn label="Layer" onClick={() => setLayerOpen(!layerOpen)} active={layerOpen}><Layers className="h-4 w-4" /></CtxBtn>
        {flippable ? <CtxBtn label="Mirror" onClick={onFlip}><FlipHorizontal2 className="h-4 w-4" /></CtxBtn> : null}
        {/* ── M26 §P3 — Connect, only where the asset takes content ──────────────
            M26-S removed Connect from the dock and never added the contextual
            replacement, so there was NO route to it at all. It belongs here: a TV, a
            laptop, a frame and a speaker take content; a plant, a sofa and a table do
            not, and offering them a link field is the confusion this replaced. The
            asset's own behaviour is never configured — only its content. */}
        {onConnect && (capabilitiesForAsset(o.assetId)?.accepts.length ?? 0) > 0 ? (
          <CtxBtn label="Connect" onClick={onConnect}><Link2 className="h-4 w-4" /></CtxBtn>
        ) : null}
        <CtxBtn label={o.locked ? "Unlock" : "Lock"} onClick={onToggleLock} active={o.locked}>{o.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</CtxBtn>
        <CtxBtn label="Delete" danger onClick={onDelete}><Trash2 className="h-4 w-4" /></CtxBtn>
        {layerOpen ? (
          <div className="absolute left-1/2 top-full mt-1 flex -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-ink/10 bg-parchment shadow-lg">
            <LayerItem label="Select object…" onClick={() => { onOpenLayerPicker(); }}><Layers className="h-3.5 w-3.5" /></LayerItem>
            <span className="h-px bg-ink/10" />
            <LayerItem label="Bring to front" onClick={() => { onReorder("front"); setLayerOpen(false); }}><ArrowUpToLine className="h-3.5 w-3.5" /></LayerItem>
            <LayerItem label="Bring forward" onClick={() => { onReorder("forward"); setLayerOpen(false); }}><ChevronUp className="h-3.5 w-3.5" /></LayerItem>
            <LayerItem label="Send backward" onClick={() => { onReorder("backward"); setLayerOpen(false); }}><ChevronDown className="h-3.5 w-3.5" /></LayerItem>
            <LayerItem label="Send to back" onClick={() => { onReorder("back"); setLayerOpen(false); }}><ArrowDownToLine className="h-3.5 w-3.5" /></LayerItem>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CtxBtn({ label, onClick, children, active, danger }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`flex h-9 w-9 items-center justify-center rounded-full transition ${danger ? "text-terracotta hover:bg-terracotta/10" : active ? "bg-cobalt/15 text-cobalt" : "text-ink/70 hover:bg-ink/5"}`}>
      {children}
    </button>
  );
}

function LayerItem({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-xs font-bold text-ink/75 hover:bg-ink/5">
      {children} {label}
    </button>
  );
}

// Long-press / "Select object" overlap picker. Lists every object under the point in
// effective z-order (topmost first), with thumbnails + names (never raw ids), the
// current selection ticked. Tap an item to select it; tap outside or press Escape to
// dismiss. Keyboard accessible (each row is a focusable menu item). Kept compact so it
// never covers most of the canvas.
function LayerPicker({
  nx,
  ny,
  ids,
  objects,
  assetsById,
  selectedId,
  onPick,
  onClose,
}: {
  nx: number;
  ny: number;
  ids: string[];
  objects: EditableNestObject[];
  assetsById: Record<string, LivingNestAsset>;
  selectedId?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  const left = Math.min(0.66, Math.max(0.04, nx));
  const top = Math.min(0.62, Math.max(0.04, ny));
  return (
    <>
      <button type="button" aria-label="Close object picker" tabIndex={-1} className="absolute inset-0 z-[640] cursor-default bg-transparent" onPointerDown={onClose} />
      <div
        ref={ref}
        role="menu"
        aria-label="Select object"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
        className="absolute z-[650] max-h-[44%] w-44 overflow-y-auto overscroll-contain rounded-2xl border border-ink/12 bg-parchment/98 p-1 shadow-xl outline-none backdrop-blur"
        style={{ left: pctOf(left), top: pctOf(top) }}
      >
        <p className="px-2 pb-1 pt-1 text-[9px] font-black uppercase tracking-[.16em] text-ink/45">Select object</p>
        {ids.map((id) => {
          const o = objects.find((x) => x.instanceId === id);
          if (!o) return null;
          const asset = assetsById[o.assetId];
          const sel = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={sel}
              onClick={() => onPick(id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-bold transition ${sel ? "bg-cobalt/12 text-cobalt" : "text-ink/75 hover:bg-ink/5"}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-white/70">
                {asset?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.thumbnailUrl} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{asset?.name ?? o.assetId}</span>
              {sel ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

// Transient smart alignment guides (Nestudio saffron) shown only during a gesture.
function AlignGuides({ guides }: { guides: AlignGuide[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[450]" aria-hidden>
      {guides.map((g, i) =>
        g.axis === "x" ? (
          <span key={`g${i}`} className="absolute top-0 h-full w-px bg-saffron shadow-[0_0_4px_rgba(232,162,60,.7)]" style={{ left: `${g.pos * 100}%` }} />
        ) : (
          <span key={`g${i}`} className="absolute left-0 w-full border-t border-saffron shadow-[0_0_4px_rgba(232,162,60,.7)]" style={{ top: `${g.pos * 100}%` }} />
        ),
      )}
    </div>
  );
}

function GridGuides({ cols, rows }: { cols: number; rows: number }) {
  const v = Array.from({ length: cols - 1 }, (_, i) => ((i + 1) / cols) * 100);
  const h = Array.from({ length: rows - 1 }, (_, i) => ((i + 1) / rows) * 100);
  return (
    <div className="pointer-events-none absolute inset-0 z-[400]" aria-hidden>
      {v.map((x) => (<span key={`v${x}`} className="absolute top-0 h-full w-px bg-ink/5" style={{ left: `${x}%` }} />))}
      {h.map((y) => (<span key={`h${y}`} className="absolute left-0 w-full border-t border-ink/5" style={{ top: `${y}%` }} />))}
      <span className="absolute top-0 h-full w-px bg-cobalt/25" style={{ left: "50%" }} />
      {[33.333, 66.667].map((x) => (<span key={`t${x}`} className="absolute top-0 h-full w-px bg-cobalt/12" style={{ left: `${x}%` }} />))}
      {[33.333, 66.667].map((y) => (<span key={`th${y}`} className="absolute left-0 w-full border-t border-cobalt/12" style={{ top: `${y}%` }} />))}
      <span className="absolute left-0 w-full border-t-2 border-dashed border-terracotta/40" style={{ top: "62%" }} />
    </div>
  );
}

const CANVAS_CSS = `
.editor-scene { background: linear-gradient(180deg, #efe2c4 0%, #e7d3ad 62%, #d8c096 100%); touch-action: none; }
/* M14 delight: newly-mounted pieces gently pop in (a placement animation). Only new
   elements animate — React keys existing pieces by instanceId, so moves never re-trigger it. */
@keyframes piece-in { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
.editor-piece { cursor: grab; animation: piece-in .26s cubic-bezier(.22,.61,.36,1) both; }
.editor-piece:active { cursor: grabbing; }
@media (prefers-reduced-motion: reduce) { .editor-piece { animation: none; } }
.editor-contact-shadow { position:absolute; left:50%; bottom:0; width:72%; aspect-ratio:6 / 1; transform:translate(-50%,34%); background:radial-gradient(50% 50% at 50% 50%, rgba(70,54,90,.30) 0%, rgba(70,54,90,.12) 55%, rgba(70,54,90,0) 75%); filter:blur(2px); pointer-events:none; }
`;
