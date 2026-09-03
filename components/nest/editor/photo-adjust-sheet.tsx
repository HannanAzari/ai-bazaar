"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  DEFAULT_CROP,
  MAX_CROP_ZOOM,
  mediaCropStyle,
  normaliseCrop,
  panCrop,
  zoomCrop,
  type MediaCrop,
} from "@/lib/nest-media-crop";

// ── M28.1 §3 — Adjust ────────────────────────────────────────────────────────
//
// The creator drags the photo under a FIXED aperture, exactly like setting a profile
// picture. The aperture never moves, so what they see while dragging is literally what the
// frame will show — the preview and the room render through the same `mediaCropStyle`, so
// there is no "preview approximation" that could disagree with the result.
//
// ── WHY THIS DOES NOT TOUCH THE SCENE CAMERA ─────────────────────────────────
//
// It would be tempting to reuse `use-scene-camera`: it already does pan and pinch, and it
// is the one pointer pipeline for the room. But the room's camera and this crop are not the
// same idea. The camera is a viewport transform that is never persisted (freeze §1); a crop
// is document data the creator is authoring. Wiring the two together would mean either the
// camera learning to write to a document or the crop borrowing a transform that resets on
// every mount — and the "one gesture owner" rule exists for the SCENE, which this sheet is
// not part of. It is a modal above the editor with its own two-pointer state, and the scene
// receives none of its events.
//
// The maths is not here either: `lib/nest-media-crop.ts` owns it, so the drag-to-crop
// relationship is unit-testable without a DOM.

export function PhotoAdjustSheet({
  src,
  aspectRatio,
  crop,
  onCancel,
  onDone,
}: {
  src: string;
  /** The REAL aperture shape (scene 3:4 × object box × aperture box) — see `apertureAspectRatio`. */
  aspectRatio: number;
  crop: MediaCrop | undefined;
  onCancel: () => void;
  onDone: (crop: MediaCrop) => void;
}) {
  const [draft, setDraft] = useState<MediaCrop>(() => normaliseCrop(crop));
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Live pointers, by id. Two ⇒ pinch, one ⇒ drag. A ref because a gesture must survive the
  // re-render each move causes, and because pointer state is not something to render.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const boxOf = () => {
    const r = frameRef.current?.getBoundingClientRect();
    return r ? { width: r.width, height: r.height } : null;
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = null; // a new finger restarts the pinch baseline rather than jumping
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const live = pointers.current;
      if (!live.has(e.pointerId)) return;
      const previous = live.get(e.pointerId);
      live.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const box = boxOf();
      if (!box || !natural || !previous) return;

      const points = Array.from(live.values());
      if (points.length >= 2) {
        // ── Pinch ──────────────────────────────────────────────────────────
        // Ratio against the distance when the second finger landed, so the zoom tracks the
        // fingers instead of accumulating per-event drift.
        const [a, b] = points;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (!pinch.current) {
          pinch.current = { distance, zoom: draft.zoom };
          return;
        }
        if (pinch.current.distance <= 0) return;
        const factor = distance / pinch.current.distance;
        setDraft((c) => zoomCrop({ ...c, zoom: pinch.current?.zoom ?? c.zoom }, factor));
        return;
      }

      // ── Drag ─────────────────────────────────────────────────────────────
      setDraft((c) => panCrop(c, e.clientX - previous.x, e.clientY - previous.y, natural, box));
    },
    [draft.zoom, natural],
  );

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }, []);

  // Escape cancels — the same reflex the media player and every sheet answer to.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const zoomPercent = Math.round(draft.zoom * 100);

  return (
    // `data-editor-chrome` is load-bearing, not decoration: the gesture layer ignores taps
    // inside it (freeze §2), which is what stops a control here from being eaten by pointer
    // capture. A new surface that forgets this marker is dead to a finger.
    <div data-editor-chrome className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pb-1 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-full px-3 text-[15px] font-semibold text-ink/60 hover:bg-ink/5"
        >
          Cancel
        </button>
        <h3 className="display text-[16px] leading-tight text-ink">Adjust photo</h3>
        <button
          type="button"
          onClick={() => onDone(draft)}
          className="min-h-11 rounded-full bg-ink px-4 text-[15px] font-semibold text-parchment"
        >
          Done
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 pb-5">
        {/* The aperture, at the frame's REAL shape. Fixed: the image moves underneath it. */}
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          className="relative max-h-full w-full max-w-sm touch-none select-none overflow-hidden rounded-xl border border-ink/15 bg-ink/[0.06] shadow-inner"
          style={{ aspectRatio: `${aspectRatio}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- creator media, already a URL */}
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNatural({ width: el.naturalWidth, height: el.naturalHeight });
            }}
            className="pointer-events-none size-full object-cover"
            // The SAME function the frame renders with. What the creator drags is what the
            // room draws; there is no second interpretation of these three numbers.
            style={mediaCropStyle(draft)}
          />
          {/* A thirds grid, visible only while it helps. No handles, no chrome inside the
              picture — the photo is the interface. */}
          <span aria-hidden className="pointer-events-none absolute inset-0 opacity-45">
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
            <span className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
          </span>
        </div>

        <div className="flex w-full max-w-sm items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">Zoom</span>
            {/* A slider as well as pinch: a creator on a laptop, or one whose pinch keeps
                being read as a drag, still has a way to zoom. Same clamp, same function. */}
            <input
              type="range"
              min={1}
              max={MAX_CROP_ZOOM}
              step={0.01}
              value={draft.zoom}
              onChange={(e) => setDraft((c) => normaliseCrop({ ...c, zoom: Number(e.target.value) }))}
              className="h-11 w-full accent-terracotta"
            />
            <span className="w-11 shrink-0 text-right text-[12px] tabular-nums text-ink/45">{zoomPercent}%</span>
          </label>
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_CROP)}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink/60 hover:bg-ink/5"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
        </div>

        <p className="text-center text-[12px] leading-snug text-ink/45">
          Drag to move · pinch to zoom. The original photo is never changed.
        </p>
      </div>
    </div>
  );
}
