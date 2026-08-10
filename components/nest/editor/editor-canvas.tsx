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
import { boxTransform } from "@/lib/nest-geometry";
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
import {
  beginGesture,
  classifyTarget,
  objectTransformFromPinch,
  ownerMovesCamera,
  ownerMovesObject,
  pinchSample,
  resolveGestureOwner,
  transformedCentre,
  transformRegionFor,
  upgradeGesture,
  type ActiveGesture,
  type PinchSample,
} from "@/lib/nest-gesture";
import { capabilitiesForAsset } from "@/lib/nest-asset-interaction";
import { sceneToScreen, visibleSceneCentre } from "@/lib/nest-camera";
import { rotationReadout } from "@/lib/nest-editor-chrome";
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
  /**
   * M26-P §1 — a TAP on the object that is ALREADY selected.
   *
   * This is what makes "tap again to edit this sticker" possible without conflating
   * selection with editing. The first tap selects (and gets the same chrome as any other
   * object); only this second tap opens a content editor.
   */
  onReselect?: (id: string) => void;
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
  /**
   * M26-S2 §4 — the sticker gesture. Everything it needs is captured ONCE, here, at the
   * moment the second finger lands: the two-pointer geometry, the object's centre in screen
   * pixels, and its width and rotation. Every frame is then a pure function of this and the
   * current pointer positions — nothing accumulates, so nothing drifts.
   */
  | { kind: "transform"; id: string; start: PinchSample; centrePx: Pt; startW: number; startRot: number };

type Pt = { x: number; y: number };

/**
 * M26-S2 §7 — how far a finger travels before a tap becomes a drag.
 *
 * Smaller than the camera's 10px tap slop on purpose: by the time the camera would call it
 * a drag, an object should already be following the finger, or the first few millimetres of
 * every move feel stuck.
 */
const DRAG_SLOP_PX = 5;

const pctOf = (n: number) => `${+(n * 100).toFixed(3)}%`;
/** Constant gap (px) the rotate handle sits above the selection frame. */
const snapStep = (v: number, step: number) => Math.round(v / step) * step;
const angle = (a: Pt, b: Pt) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
// ── M26-F §2 — ONE transform contract ────────────────────────────────────────
//
// `boxTransform` already carried the comment "Identical string in the editor and every
// preview" — and yet the editor, the runtime's FocusChild, the inherited-interaction layer
// and the projected-focus layer each rebuilt the string by hand. Four copies of a contract
// is not a contract. They now all call the one function, so rotation, mirror and their
// ORDER cannot drift apart again.
const transformOf = (o: EditableNestObject) => boxTransform(o) ?? "";

export function EditorCanvas(props: Props) {
  const { doc, assetsById, ambience, selectedId, onSelect, onCommit, showGrid, snap, advanced, zoom, hideChrome, gridCols = 24, gridRows = 32 } = props;
  const connect = props.connect ?? false;
  const sceneRef = useRef<HTMLDivElement>(null);
  /** Live pointer positions for the current session, in viewport-client coordinates. */
  const ptsRef = useRef<Pt[]>([]);
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
    const pts = ptsRef.current;
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
    // ── M26-S2 §4 — two fingers: move + scale + rotate, as ONE gesture ─────────
    //
    // Derived entirely from `g` (the start state) and the two live pointers. The object is
    // anchored under the fingers via `transformedCentre`, so spreading grows it away from
    // the midpoint and twisting swings it around the midpoint — the Instagram feel.
    //
    // No snapping and no alignment guides here: a free transform that quantises fights the
    // hand. Snapping stays on the one-finger move, where it helps.
    if (g.kind === "transform" && pts.length >= 2) {
      const o0 = doc.objects.find((o) => o.instanceId === g.id);
      const r = sceneRef.current?.getBoundingClientRect();
      if (!o0 || !r || r.width === 0) return doc;
      const now = pinchSample(pts[0], pts[1]);
      const t = objectTransformFromPinch(g.start, now);

      // Scale first: `resizeObject` preserves the source aspect and applies the asset's own
      // min/max guardrail, so a sticker cannot be pinched into a distorted sliver.
      let next = resizeObject(doc, g.id, g.startW * t.scale, assetsById);

      // Then place the centre. Done AFTER the resize and as an absolute target rather than
      // a delta, so the guardrail clamping above cannot leak into the position.
      const c = transformedCentre(g.centrePx, g.start, now);
      const cur = next.objects.find((o) => o.instanceId === g.id)!;
      next = moveObject(
        next,
        g.id,
        (c.x - r.left) / r.width - (cur.x + cur.width / 2),
        (c.y - r.top) / r.height - (cur.y + cur.height / 2),
        assetsById,
      );

      // Rotation is policy-gated (a rug does not rotate); `rotateObject` no-ops when the
      // asset disallows it, so scale and move still work on those.
      return rotateObject(next, g.id, g.startRot + t.rotationDeg, assetsById);
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
  /**
   * ── M26-S2 §1/§7 — selection at pointer-DOWN, cycling at pointer-UP ─────────
   *
   * Overlap cycling and dragging both begin with the same pointer-down, and they wanted
   * opposite things:
   *
   *   • tapping a stack repeatedly should walk DOWN through it (`TAP_CYCLE_TIMEOUT_MS` is
   *     1.6s, so "repeatedly" is generous);
   *   • pressing the thing you just selected and dragging must move THAT thing.
   *
   * Because cycling ran on pointer-down, the second one lost: tap a table to select it,
   * press it a moment later to drag, and the cycle advanced to the sofa underneath — so the
   * creator dragged an object they had not touched. Measured, not reasoned about.
   *
   * The fix is to split the two. At pointer-down the gesture is armed on the object that is
   * ALREADY selected whenever it lies under the finger, so a drag always moves what the
   * creator can see is selected. The cycled candidate is only remembered, and applied in
   * `up()` if the gesture turned out to be a pure tap.
   */
  const pendingCycle = useRef<{ id: string; state: TapCycleState | undefined } | null>(null);
  /** The already-selected object this gesture began on, if any (M26-P §1). */
  const reselected = useRef<string | null>(null);

  function selectAtPoint(clientX: number, clientY: number, fallback: EditableNestObject): string {
    const { nx, ny } = toNorm(clientX, clientY);
    const point = { x: nx, y: ny };
    const candidates = hitTestCandidates(liveDoc.objects, assetsById, point, { scene: sceneSize() });
    const res = nextSelection(tapCycle.current, candidates, point, nowMs());
    const cycled = res.selectedId ?? fallback.instanceId;

    // Is the current selection under this finger? Then it is what gets dragged.
    const keep = selectedId && candidates.some((c) => c.objectId === selectedId) ? selectedId : null;
    pendingCycle.current = keep && cycled !== keep ? { id: cycled, state: res.state } : null;
    if (keep) {
      // Remember that this gesture began on the current selection; `up()` decides whether
      // it stayed a tap and therefore counts as a re-tap.
      reselected.current = keep;
      return keep;
    }

    tapCycle.current = res.state;
    onSelect(cycled);
    return cycled;
  }

  // Long-press → open the layer picker when ≥2 objects overlap the point.
  function armLongPress(nx: number, ny: number) {
    clearTimeout(longPress.current);
    longPress.current = setTimeout(() => {
      const candidates = hitTestCandidates(liveDoc.objects, assetsById, { x: nx, y: ny }, { scene: sceneSize() });
      if (candidates.length >= 2) {
        gestureRef.current = null; // cancel any pending move so the picker takes over
        ptsRef.current = [];
        didMove.current = false;
        setPicker({ nx, ny, ids: candidates.map((c) => c.objectId) });
        rerender();
      }
    }, 450);
  }

  // ── M26-S2 §2 — THE ARBITER ────────────────────────────────────────────────
  //
  // The single place a gesture's owner is decided, and the only object-manipulation code
  // left in this file. It is handed to `useSceneCamera`, which is now the one and only
  // thing listening to pointers anywhere in the editor.
  //
  // WHAT WAS HERE BEFORE: React `onPointerDown` on every object, plus `onPointerMove` and
  // `onPointerUp` on the scene element — a second, independent pointer pipeline running
  // alongside the camera's native listeners on the viewport ancestor. Both saw every event.
  // The camera pinched on two fingers regardless of what this file had decided, so
  // `object-transform` was unreachable no matter what the arbiter returned. And because the
  // scene element is NOT an ancestor of the screen-space selection frame, `pointermove`
  // from a resize or rotate handle never reached those React handlers at all — which is why
  // the corner handles have been inert since the frame moved into screen space.
  //
  // One listener set, one owner, one code path for all four gestures.

  function armObject(clientX: number, clientY: number, o: EditableNestObject) {
    const id = selectAtPoint(clientX, clientY, o);
    const sel = liveDoc.objects.find((x) => x.instanceId === id) ?? o;
    const { nx, ny } = toNorm(clientX, clientY);
    armLongPress(nx, ny);
    ownerRef.current = beginGesture(
      { pointerCount: 1, target: sel.instanceId === selectedId ? "selected-object" : "other-object", scale: camScaleRef.current, objectId: sel.instanceId, locked: sel.locked },
      0,
    );
    // A locked object selects but never moves (§10) — and Connect/Surface modes select only.
    if (sel.locked || connect || props.surface) return;
    // `move` is armed even for a tap: DRAG_SLOP_PX decides whether it ever becomes one, so
    // "tap selects" and "drag moves" come from the same gesture with no mode in between.
    gestureRef.current = { kind: "move", id: sel.instanceId, startNX: nx, startNY: ny };
  }

  /** A second finger arrived while the object owned the session — become a transform (§4). */
  function armTransform(pts: Pt[]) {
    const g = ownerRef.current;
    const r = sceneRef.current?.getBoundingClientRect();
    const id = g?.objectId;
    const o = id ? liveDoc.objects.find((x) => x.instanceId === id) : undefined;
    if (!o || !r || o.locked) return;
    ownerRef.current = upgradeGesture(g!, pts.length);
    clearTimeout(longPress.current);
    gestureRef.current = {
      kind: "transform",
      id: o.instanceId,
      start: pinchSample(pts[0], pts[1]),
      // The object's centre in SCREEN pixels. The camera is frozen for the whole session
      // (§2), so this stays valid for every frame of the gesture.
      centrePx: { x: r.left + (o.x + o.width / 2) * r.width, y: r.top + (o.y + o.height / 2) * r.height },
      startW: o.width,
      startRot: o.rotation ?? 0,
    };
  }

  const arbiter = {
    down(e: PointerEvent, pts: Pt[]): boolean {
      ptsRef.current = pts;
      const el = e.target instanceof Element ? e.target : null;
      const cls = classifyTarget(
        (selector) => {
          const hit = el?.closest(selector) as HTMLElement | null;
          if (!hit) return null;
          return { id: hit.dataset.editorObject ?? "handle", locked: hit.dataset.locked === "1" };
        },
        selectedId,
      );

      // A SECOND finger. The family is already locked; all this can do is upgrade the
      // object's own subtype. If the camera owns the session, it stays the camera (§2).
      if (pts.length >= 2) {
        if (!ownerRef.current || !ownerMovesObject(ownerRef.current.owner)) {
          // The camera keeps it. Recorded so the §14 diagnostic reports CAMERA/camera-pinch
          // rather than the single-finger owner it started with.
          ownerRef.current = { owner: "camera-pinch", pointerId: 0 };
          rerender();
          return false;
        }
        armTransform(pts);
        rerender();
        return true;
      }

      // FIRST finger — this is the only moment ownership is decided.
      setLayerOpen(false);
      setPicker(null);
      didMove.current = false;
      downClient.current = { x: e.clientX, y: e.clientY };

      if (cls.target === "resize-handle" || cls.target === "rotate-handle") {
        if (!selected || selected.locked) return false;
        e.preventDefault();
        armHandle(e.clientX, e.clientY, selected, cls.target === "resize-handle" ? "resize" : "rotate", el);
        rerender();
        return true;
      }

      if (cls.target === "empty" || !cls.objectId) {
        // The camera takes it: a pan while zoomed, or a tap that deselects (§11). Nothing
        // is deselected HERE — that happens on the camera's tap, so starting a pan does not
        // throw away the creator's selection.
        ownerRef.current = beginGesture({ pointerCount: 1, target: "empty", scale: camScaleRef.current }, 0);
        tapCycle.current = undefined;
        rerender(); // so the §14 readout says CAMERA, not the previous session's owner
        return false;
      }

      const o = liveDoc.objects.find((x) => x.instanceId === cls.objectId);
      if (!o) return false;
      e.preventDefault();
      armObject(e.clientX, e.clientY, o);
      rerender();
      return true;
    },

    move(pts: Pt[]) {
      ptsRef.current = pts;
      const g = gestureRef.current;
      if (!g) return;

      if (g.kind === "transform") {
        // A pinch is a move the instant it changes anything; there is no such thing as a
        // two-finger tap that should land in history.
        const t = objectTransformFromPinch(g.start, pinchSample(pts[0], pts[1]));
        if (Math.abs(t.scale - 1) > 0.01 || Math.abs(t.rotationDeg) > 0.5 || Math.hypot(t.dx, t.dy) > DRAG_SLOP_PX) {
          didMove.current = true;
        }
        rerender();
        return;
      }

      // §7 — nothing moves until the finger has actually travelled, so a tap that wobbles a
      // pixel selects instead of nudging the object a pixel out of place.
      if (!didMove.current) {
        const d = downClient.current;
        if (d && Math.hypot(pts[0].x - d.x, pts[0].y - d.y) < DRAG_SLOP_PX) return;
        clearTimeout(longPress.current);
        didMove.current = true;
      }
      rerender();
    },

    up(tapped: boolean) {
      clearTimeout(longPress.current);
      downClient.current = null;
      // A pure tap on a stack advances the overlap cycle; a drag never does.
      const pc = pendingCycle.current;
      const wasTap = tapped && !didMove.current;
      if (wasTap && pc) {
        tapCycle.current = pc.state;
        onSelect(pc.id);
      } else if (wasTap && reselected.current) {
        // M26-P §1 — a tap that landed on the object already selected, and moved nothing.
        // Reported only at pointer-UP, so a press-and-drag can never be mistaken for it.
        props.onReselect?.(reselected.current);
      }
      reselected.current = null;
      pendingCycle.current = null;
      commit();
      ptsRef.current = [];
      rerender();
    },
  };

  function armHandle(clientX: number, clientY: number, o: EditableNestObject, kind: "resize" | "rotate", el: Element | null) {
    clearTimeout(longPress.current);
    ownerRef.current = beginGesture(
      { pointerCount: 1, target: kind === "resize" ? "resize-handle" : "rotate-handle", scale: camScaleRef.current, objectId: o.instanceId, locked: o.locked },
      0,
    );
    if (kind === "resize") {
      const { nx } = toNorm(clientX, clientY);
      // Which corner: read the direction the handle itself declares.
      const dirX = Number((el?.closest("[data-resize-handle]") as HTMLElement | null)?.dataset.dirX ?? 1) || 1;
      gestureRef.current = { kind: "resize", id: o.instanceId, dirX, startNX: nx, startW: o.width };
    } else {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const { nx, ny } = toNorm(clientX, clientY);
      gestureRef.current = { kind: "rotate", id: o.instanceId, cx, cy, startAngle: angle({ x: cx, y: cy }, { x: nx, y: ny }), startRot: o.rotation ?? 0 };
    }
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
    arbiter,
    // §11 — a tap on empty room deselects. It rides the camera's tap classification rather
    // than firing on pointer-down, so BEGINNING a pan does not throw the selection away.
    onTap: () => {
      onSelect(undefined);
      setLayerOpen(false);
      setPicker(null);
      tapCycle.current = undefined;
    },
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
          // No pointer handlers. Every gesture in this editor enters through the camera's
          // single listener set and is routed by the arbiter above (§2).
          className="editor-scene absolute inset-0 isolate touch-none select-none overflow-hidden rounded-[24px] border border-ink/10 shadow-xl"
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
                aria-label={`${o.overlay ? (o.overlay.kind === "text" ? `Text: ${o.overlay.text}` : "Image sticker") : asset?.name ?? o.assetId}${o.locked ? " (locked)" : ""}`}
              >
                {/* ── M26-F §2 — THE PLACEMENT ANIMATION LIVES IN HERE ──────────────
                    The pop-in used to run on the button itself, which is the element that
                    carries the object's rotation and mirror. A CSS animation beats an
                    inline style in the cascade, and `animation-fill-mode: both` keeps the
                    final keyframe applied forever — so `to { transform: scale(1) }`
                    permanently overwrote every rotation and flip in Edit. Preview has no
                    such animation, which is exactly why the two disagreed.
                    Nesting it means the wrapper owns the pop-in scale and the button owns
                    the object transform; neither can overwrite the other. */}
                <span className="editor-piece-in absolute inset-0 block">
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
                </span>
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
          rotatable={canRotateObject(selected, selectedAsset)}
          toolbar={
            <ContextBar o={selected} asset={selectedAsset} layerOpen={layerOpen} setLayerOpen={setLayerOpen} onDuplicate={props.onDuplicate} onReorder={props.onReorder} onFlip={props.onFlip} onToggleLock={props.onToggleLock} onDelete={props.onDelete} onConnect={props.onConnect} onOpenLayerPicker={openLayerPickerForSelected} />
          }
        />
      ) : null}

      {/* ── M26-P §2 — the rotation readout ────────────────────────────────────
          Shown while EITHER rotate path is live (two fingers or the rotate handle) and
          lingering briefly after, so the creator can read the angle they landed on. It
          lives in SCREEN space beside the frame; the old one was positioned in scene
          percentages, so at 5× it flew off with the room. */}
      {!connect && !props.surface && !hideChrome && selected && !selected.hidden ? (
        <RotationReadout
          deg={selected.rotation ?? 0}
          active={gestureRef.current?.kind === "rotate" || gestureRef.current?.kind === "transform"}
          rect={visibleRect(selected, selected.assetId)}
          subscribe={camera.subscribe}
          viewportRef={rootRef}
          baseSizeRef={baseSizeRef}
        />
      ) : null}

      <GestureDebug owner={ownerRef.current} gesture={gestureRef.current} points={ptsRef.current} selectedId={selectedId} subscribe={camera.subscribe} />

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

/**
 * M26-P §2 — a transient `18°` / `−32°` pill above the selected object.
 *
 * Positioned per camera frame in screen pixels (like every other piece of chrome) and held
 * visible for a moment after the gesture ends, then faded out. It is deliberately NOT part
 * of `ScreenSpaceSelection`: it must survive a gesture that hides nothing else, and it has
 * its own lifetime.
 */
function RotationReadout({
  deg,
  active,
  rect,
  subscribe,
  viewportRef,
  baseSizeRef,
}: {
  deg: number;
  active: boolean;
  rect: { x: number; y: number; width: number; height: number };
  subscribe: (fn: (cam: import("@/lib/nest-camera").Camera) => void) => () => void;
  viewportRef: React.RefObject<HTMLElement | null>;
  baseSizeRef: React.RefObject<{ width: number; height: number }>;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const hideAt = useRef(0);
  const shown = useRef(false);

  if (active) {
    hideAt.current = Date.now() + 900; // linger after the fingers lift
    shown.current = true;
  }

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    return subscribe((cam) => {
      const el = elRef.current;
      const base = baseSizeRef.current;
      if (!el || !base) return;
      const vr = vp.getBoundingClientRect();
      const r = { left: vr.left, top: vr.top, width: vr.width, height: vr.height };
      const tl = sceneToScreen({ nx: rect.x + rect.width / 2, ny: rect.y }, cam, r, base);
      const host = el.offsetParent as HTMLElement | null;
      const hr = host?.getBoundingClientRect() ?? { left: 0, top: 0 };
      el.style.left = `${tl.x - hr.left}px`;
      el.style.top = `${Math.max(vr.top + 6, tl.y - 30) - hr.top}px`;
    });
  }, [subscribe, viewportRef, baseSizeRef, rect.x, rect.y, rect.width]);

  // Drive the fade from a timer rather than a render: the gesture does not re-render on
  // pointer-up, so a purely reactive approach would leave the pill on screen.
  useEffect(() => {
    if (!active) return;
    const el = elRef.current;
    if (el) el.style.opacity = "1";
    const t = window.setInterval(() => {
      if (Date.now() < hideAt.current) return;
      if (elRef.current) elRef.current.style.opacity = "0";
      window.clearInterval(t);
    }, 120);
    return () => window.clearInterval(t);
  }, [active]);

  if (!shown.current) return null;
  return (
    <div
      ref={elRef}
      data-rotation-readout=""
      className="pointer-events-none absolute z-[700] -translate-x-1/2 rounded-full bg-ink/85 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-parchment transition-opacity duration-300"
      style={{ left: 0, top: 0, opacity: active ? 1 : 0 }}
    >
      {rotationReadout(deg)}
    </div>
  );
}

// ── M26-S2 §14 — the gesture diagnostic ──────────────────────────────────────
//
// Development only. `process.env.NODE_ENV` is statically replaced at build time, so the
// whole component — overlay, listener and all — is dead code the bundler drops from
// production. It cannot ship visibly because it cannot ship.
//
// It exists because the ownership invariant is not observable any other way: "the camera
// never moved during that transform" is a claim about something that DIDN'T happen, and
// screenshots cannot show it. `window.__nestGesture` makes it a value that can be read
// while a gesture is live, which is how §15 was actually walked rather than assumed.
function GestureDebug({
  owner,
  gesture,
  points,
  selectedId,
  subscribe,
}: {
  owner: ActiveGesture | null;
  gesture: Gesture | null;
  points: Pt[];
  selectedId?: string;
  subscribe: (fn: (cam: { scale: number }) => void) => () => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const state = {
    owner: !owner ? "NONE" : ownerMovesObject(owner.owner) ? "OBJECT" : ownerMovesCamera(owner.owner) ? "CAMERA" : "NONE",
    subtype: gesture?.kind ? ({ move: "object-drag", transform: "object-transform", resize: "object-resize", rotate: "object-rotate" } as const)[gesture.kind] : owner?.owner ?? "tap",
    pointers: points.length,
    selectedId: selectedId ?? null,
  };
  const isDev = process.env.NODE_ENV !== "production";

  // The camera never re-renders React during a gesture (that is the whole point), so the
  // scale has to come from the per-frame subscription or the readout lies about it.
  useEffect(() => {
    if (!isDev) return;
    return subscribe((cam) => {
      scaleRef.current = cam.scale;
      const w = window as unknown as { __nestGesture?: Record<string, unknown> };
      if (w.__nestGesture) w.__nestGesture.scale = Math.round(cam.scale * 100) / 100;
      const el = elRef.current;
      if (el) el.textContent = `${state.owner} · ${state.subtype} · ${state.pointers}p · ${Math.round(cam.scale * 100) / 100}×`;
    });
  });

  useEffect(() => {
    if (!isDev) return;
    (window as unknown as { __nestGesture?: unknown }).__nestGesture = { ...state, scale: Math.round(scaleRef.current * 100) / 100 };
  });

  if (!isDev) return null;
  return (
    <div ref={elRef} data-gesture-debug="" className="pointer-events-none absolute bottom-2 left-2 z-[900] rounded-lg bg-ink/80 px-2 py-1 font-mono text-[9px] leading-tight text-parchment">
      {state.owner} · {state.subtype} · {state.pointers}p · {Math.round(scaleRef.current * 100) / 100}×
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
/* The button carries the OBJECT transform (rotation + mirror) and must never be animated:
   a CSS animation outranks an inline style, so animating it here silently discarded every
   rotation and flip in Edit mode. The pop-in belongs to the inner wrapper. */
.editor-piece { cursor: grab; }
.editor-piece-in { animation: piece-in .26s cubic-bezier(.22,.61,.36,1) both; }
.editor-piece:active { cursor: grabbing; }
@media (prefers-reduced-motion: reduce) { .editor-piece-in { animation: none; } }
.editor-contact-shadow { position:absolute; left:50%; bottom:0; width:72%; aspect-ratio:6 / 1; transform:translate(-50%,34%); background:radial-gradient(50% 50% at 50% 50%, rgba(70,54,90,.30) 0%, rgba(70,54,90,.12) 55%, rgba(70,54,90,0) 75%); filter:blur(2px); pointer-events:none; }
`;
