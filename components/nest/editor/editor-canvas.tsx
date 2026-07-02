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
  gridCols?: number;
  gridRows?: number;
  onDuplicate: () => void;
  onReorder: (op: ReorderOp) => void;
  onFlip: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
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
  | { kind: "pinch"; id: string; startDist: number; startW: number; startAngle: number; startRot: number };

type Pt = { x: number; y: number };

const pctOf = (n: number) => `${+(n * 100).toFixed(3)}%`;
/** Constant gap (px) the rotate handle sits above the selection frame. */
const ROTATE_GAP = EDITOR_TOUCH_TARGETS.rotateHandleGapPx;
const snapStep = (v: number, step: number) => Math.round(v / step) * step;
const angle = (a: Pt, b: Pt) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const transformOf = (o: EditableNestObject) =>
  `${o.rotation ? `rotate(${o.rotation}deg)` : ""}${o.flipX ? " scaleX(-1)" : ""}`.trim();

export function EditorCanvas(props: Props) {
  const { doc, assetsById, ambience, selectedId, onSelect, onCommit, showGrid, snap, advanced, zoom, gridCols = 24, gridRows = 32 } = props;
  const connect = props.connect ?? false;
  const sceneRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, Pt>>(new Map());
  const gestureRef = useRef<Gesture | null>(null);
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
    if (g.kind === "pinch" && pts[0] && pts[1]) {
      const scale = g.startDist > 0 ? dist(pts[0], pts[1]) / g.startDist : 1;
      let next = resizeObject(doc, g.id, g.startW * scale, assetsById);
      let rot = g.startRot + (angle(pts[0], pts[1]) - g.startAngle);
      if (snap) rot = snapRotation(rot, 6);
      next = rotateObject(next, g.id, rot, assetsById);
      return next;
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
    if (pts.length >= 2) {
      gestureRef.current = { kind: "pinch", id: sel.instanceId, startDist: dist(pts[0], pts[1]), startW: sel.width, startAngle: angle(pts[0], pts[1]), startRot: sel.rotation ?? 0 };
    } else {
      gestureRef.current = { kind: "move", id: sel.instanceId, startNX: nx, startNY: ny };
    }
    rerender();
  }

  function onHandleDown(e: React.PointerEvent, o: EditableNestObject, kind: "resize" | "rotate", dirX = 1) {
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(longPress.current);
    didMove.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    capture(e);
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
    e.preventDefault();
    didMove.current = true;
    const pts = Array.from(pointers.current.values());
    if (g.kind === "move" && pts.length >= 2) {
      const o = doc.objects.find((x) => x.instanceId === g.id)!;
      gestureRef.current = { kind: "pinch", id: g.id, startDist: dist(pts[0], pts[1]), startW: o.width, startAngle: angle(pts[0], pts[1]), startRot: o.rotation ?? 0 };
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
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-2">
      <style>{CANVAS_CSS}</style>
      {/* Aspect-locked fit: an oversized base clamped by both max-dimensions keeps the
          scene a true 3:4 (full room visible, including side walls) regardless of the
          viewport shape. Zoom scales both clamps. */}
      <div className="relative" style={{ width: "9999px", aspectRatio: aspectRatioCss(doc.aspectRatio as "3:4"), maxWidth: `${Math.round(96 * zoom)}%`, maxHeight: `${Math.round(100 * zoom)}%` }}>
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

          {/* Arrange chrome (hidden in Connect / Surface modes) */}
          {!connect && !props.surface && selected && !selected.hidden ? <TransformFrame o={selected} asset={selectedAsset} advanced={advanced} onHandleDown={onHandleDown} /> : null}

          {/* Transient rotation degree label while rotating/pinching a rotatable object. */}
          {!connect && selected && (gestureRef.current?.kind === "rotate" || gestureRef.current?.kind === "pinch") && selected.rotation != null ? (
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

        {/* Contextual arrange action bar — outside the clipped scene (Arrange only) */}
        {!connect && !props.surface && selected && !selected.hidden ? (
          <ContextBar o={selected} vr={selectedVr!} placement={barPlacement} asset={selectedAsset} layerOpen={layerOpen} setLayerOpen={setLayerOpen} onDuplicate={props.onDuplicate} onReorder={props.onReorder} onFlip={props.onFlip} onToggleLock={props.onToggleLock} onDelete={props.onDelete} onOpenLayerPicker={openLayerPickerForSelected} />
        ) : null}

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

function TransformFrame({ o, asset, advanced, onHandleDown }: { o: EditableNestObject; asset?: LivingNestAsset; advanced: boolean; onHandleDown: (e: React.PointerEvent, o: EditableNestObject, kind: "resize" | "rotate", dirX?: number) => void }) {
  const t = transformOf(o);
  const rotatable = canRotateObject(o, asset) && !o.locked;
  // The selection frame wraps the VISIBLE content (not the transparent PNG padding),
  // so padded assets (avatar, lamp) get a tight, believable selection box.
  const vr = visibleRect(o, o.assetId);
  const anchorLeft = vr.width > 0 ? ((o.anchor.x - vr.x) / vr.width) * 100 : 50;
  const anchorTop = vr.height > 0 ? ((o.anchor.y - vr.y) / vr.height) * 100 : 100;
  return (
    <div className="pointer-events-none absolute z-[500]" style={{ left: pctOf(vr.x), top: pctOf(vr.y), width: pctOf(vr.width), height: pctOf(vr.height), transform: t || undefined, transformOrigin: "center" }}>
      <div className={`absolute inset-0 rounded-[10px] ${o.locked ? "border-2 border-dashed border-terracotta/80" : "border-[2px] border-cobalt"}`} style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.7), 0 1px 6px rgba(70,54,90,.25)" }} />
      {!o.locked
        ? ([
            [0, 0, -1],
            [1, 0, 1],
            [0, 1, -1],
            [1, 1, 1],
          ] as const).map(([cx, cy, dirX]) => (
            // 40px invisible touch target (≥32px policy) around a small visible dot, so
            // even a tiny object's corners stay grabbable without enlarging the art.
            <span key={`${cx}-${cy}`} className="pointer-events-auto absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none items-center justify-center" style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }} onPointerDown={(e) => onHandleDown(e, o, "resize", dirX)}>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-cobalt bg-white shadow" />
            </span>
          ))
        : (
            <span className="absolute right-1 top-1 rounded-full bg-terracotta/90 p-1 text-white"><Lock className="h-3 w-3" /></span>
          )}
      {rotatable ? (
        // The rotate handle sits a CONSTANT pixel gap above the frame (never a % of the
        // frame, so it can't collapse onto a tiny object), with a ~44px invisible touch
        // target and a fixed-length connector. It is outside the frame and clear of the
        // object body, so dragging the body never hits it.
        <>
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bg-cobalt/60" style={{ top: `-${ROTATE_GAP}px`, height: `${ROTATE_GAP}px`, width: 1 }} aria-hidden />
          <button type="button" aria-label="Rotate" className="pointer-events-auto absolute left-1/2 flex h-11 w-11 cursor-grab touch-none items-center justify-center" style={{ top: 0, transform: `translate(-50%, calc(-100% - ${ROTATE_GAP}px))` }} onPointerDown={(e) => onHandleDown(e, o, "rotate")}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-cobalt bg-white shadow"><RotateCw className="h-3 w-3 text-cobalt" /></span>
          </button>
        </>
      ) : null}
      {advanced ? <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-saffron ring-2 ring-white" style={{ left: `${anchorLeft}%`, top: `${anchorTop}%` }} /> : null}
    </div>
  );
}

function ContextBar({ o, vr, placement, asset, layerOpen, setLayerOpen, onDuplicate, onReorder, onFlip, onToggleLock, onDelete, onOpenLayerPicker }: { o: EditableNestObject; vr: NormalizedRect; placement: ToolbarPlacement; asset?: LivingNestAsset; layerOpen: boolean; setLayerOpen: (v: boolean) => void; onDuplicate: () => void; onReorder: (op: ReorderOp) => void; onFlip: () => void; onToggleLock: () => void; onDelete: () => void; onOpenLayerPicker: () => void }) {
  // Centre on the VISIBLE rect; pick the side + offset that clears the resize/rotation handles.
  const cx = (vr.x + vr.width / 2) * 100;
  const flippable = canFlipObject(o, asset);
  const pos: React.CSSProperties = { left: `${Math.min(80, Math.max(20, cx))}%` };
  if (placement.side === "above") {
    pos.top = `${vr.y * 100}%`;
    pos.transform = `translate(-50%, calc(-100% - ${placement.offsetPx}px))`;
  } else {
    pos.top = `${(vr.y + vr.height) * 100}%`;
    pos.transform = `translate(-50%, ${placement.offsetPx}px)`;
  }
  return (
    <div className="pointer-events-none absolute z-[600] flex justify-center" style={pos}>
      <div className="pointer-events-auto relative flex items-center gap-0.5 rounded-full border border-ink/10 bg-parchment/95 p-1 shadow-lg backdrop-blur">
        <CtxBtn label="Duplicate" onClick={onDuplicate}><Copy className="h-4 w-4" /></CtxBtn>
        <CtxBtn label="Layer" onClick={() => setLayerOpen(!layerOpen)} active={layerOpen}><Layers className="h-4 w-4" /></CtxBtn>
        {flippable ? <CtxBtn label="Flip" onClick={onFlip}><FlipHorizontal2 className="h-4 w-4" /></CtxBtn> : null}
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
.editor-piece { cursor: grab; }
.editor-piece:active { cursor: grabbing; }
.editor-contact-shadow { position:absolute; left:50%; bottom:0; width:72%; aspect-ratio:6 / 1; transform:translate(-50%,34%); background:radial-gradient(50% 50% at 50% 50%, rgba(70,54,90,.30) 0%, rgba(70,54,90,.12) 55%, rgba(70,54,90,0) 75%); filter:blur(2px); pointer-events:none; }
`;
