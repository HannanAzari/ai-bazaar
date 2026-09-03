"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { LAYER } from "@/lib/nest-layers";
import { swipeIntent } from "@/lib/nest-media-session";

// ── M28.1 §5/§6 — the photo gallery ──────────────────────────────────────────
//
// Tapping a Framed Photo used to do NOTHING. `contentInteraction` returns null for an image
// on an object that has a screen — correct, because a photo already lives on the object and
// throwing a link modal over the room would be exactly the mistake M27B-3A2 fixed for the
// television. But it left a frame with no way to see the photograph properly: the aperture
// is a few hundred pixels wide and, from M28.1, deliberately cropped.
//
// So a tap opens THIS: the photo at full size, the room dimmed behind it, and nothing else.
//
// WHAT IT IS NOT. It is not `MediaOverlay` (the legacy `open-url` card for pre-M25 Nests)
// and must never become it. That surface is a browser chrome bar with a link in it; this is
// a photograph. They look nothing alike on purpose.
//
// ── THE THREE RULES IT INHERITS FROM THE PLAYER ──────────────────────────────
//
// 1. NO INDEX OF ITS OWN (§6). `index` is a prop and every change is `onStep` — the same
//    write a swipe on the aperture makes, into the same session map the frame reads. The
//    frame under the gallery therefore cannot fall out of step with it, because there is
//    nothing to keep in step. Closing leaves the frame on whatever the gallery ended on,
//    which is the required behaviour and is free rather than implemented.
// 2. THE ROOM IS NOT TOUCHED (§7). Nothing here reads, writes, saves or restores the
//    camera, and nothing writes visual state. Zoom and pan survive open→close by
//    construction — there is no code here with the power to change them.
// 3. IT PORTALS TO <body> AT `LAYER.player`. Above the editor shell, so a creator's Preview
//    can open it; above the scene, so it never scales with the camera.
//
//    NOTE `LAYER`, the numeric map — NOT the `z` export, which is a map of Tailwind CLASS
//    strings ("z-[120]"). This file first imported `z` and used it as `style.zIndex`, which
//    is not a valid CSS value: the computed z-index came back `auto` and the gallery would
//    have stacked by DOM order — painting UNDER the editor shell in Preview, which is
//    exactly the M27B-3B failure the freeze document records. Measured, not read.
//
// The pointer handlers are React props on THIS overlay, which sits above the scene and
// takes its own events. They are not a second scene pipeline: `use-scene-camera` is still
// the only thing listening to the room, and it never sees these pointers because the
// overlay is on top of it. The swipe RULE is not re-implemented either — `swipeIntent` is
// the same threshold and the same dominantly-horizontal test the aperture uses, so a swipe
// that changes the photo in the frame changes it in the gallery too.

export function NestPhotoGallery({
  src,
  index,
  count,
  label,
  onStep,
  onClose,
}: {
  src: string;
  /** Zero-based, and owned by the runtime — never by this component. */
  index: number;
  count: number;
  label?: string;
  onStep: (direction: 1 | -1) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape closes; the arrows step. A phone never sends these, but a creator checking their
  // Nest on a laptop reaches for them immediately and their absence reads as broken.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && count > 1) onStep(1);
      else if (e.key === "ArrowLeft" && count > 1) onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep, count]);

  // One gesture, one photo. Without `fired`, a long drag races through the whole set.
  // A ref, not a local: `onStep` re-renders this component mid-gesture, and a local would be
  // silently reinitialised by that render — the swipe would keep working by accident and
  // break the moment the render behaviour changed.
  //
  // Declared BEFORE the mount guard: every hook in this component must run on every render,
  // and an early return above it would make the hook order conditional.
  const start = useRef<{ x: number; y: number; fired: boolean } | null>(null);

  if (!mounted) return null;

  const node = (
    <div
      data-nest-gallery=""
      role="dialog"
      aria-modal
      aria-label={label ? `${label} — photo ${index + 1} of ${count}` : `Photo ${index + 1} of ${count}`}
      className="fixed inset-0 flex items-center justify-center nest-gallery-in"
      style={{ zIndex: LAYER.player }}
    >
      {/* ── The room behind: dimmed AND softly blurred, never replaced ───────
          The dim is inline `rgba`, not a Tailwind alpha class. M27B-3B measured that
          `bg-[#0d0c10]/72` computed to `rgba(0,0,0,0)` here — the blur landed, the dim
          silently did not, and the room stayed bright behind the surface. Same lesson,
          same fix, and it stays inline for the same reason. */}
      <div
        aria-hidden
        onPointerDown={onClose}
        className="absolute inset-0 backdrop-blur-xl"
        style={{ backgroundColor: "rgba(13, 12, 16, 0.82)" }}
      />

      {/* The photograph. `object-contain` and NO crop: the frame's crop is how the creator
          chose to display it in the room, and this is the place to see what it was cut from
          (§5). The element is the natural-aspect box itself, so nothing letterboxes it. */}
      <div
        className="relative flex h-full w-full items-center justify-center px-4 py-16"
        onPointerDown={(e) => {
          if (!e.isPrimary) return;
          start.current = { x: e.clientX, y: e.clientY, fired: false };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.fired || count < 2) return;
          const dir = swipeIntent(e.clientX - s.x, e.clientY - s.y);
          if (!dir) return;
          s.fired = true;
          onStep(dir);
        }}
        onPointerUp={() => { start.current = null; }}
        onPointerCancel={() => { start.current = null; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- creator media, already a URL */}
        <img
          key={src}
          src={src}
          alt={label ?? ""}
          draggable={false}
          className="nest-gallery-photo max-h-full max-w-full select-none object-contain"
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-3 grid size-11 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10"
        style={{ top: "max(env(safe-area-inset-top), 12px)" }}
      >
        <X className="size-6" />
      </button>

      {/* Restrained by instruction (§5): a small count, low contrast, no dots, no arrows,
          and absent entirely for a single photo — chrome a visitor did not ask for is the
          fastest way to make a photograph look like a carousel widget. */}
      {count > 1 ? (
        <p
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[13px] font-medium tabular-nums text-white/55"
          style={{ bottom: "max(env(safe-area-inset-bottom), 18px)" }}
        >
          {index + 1} / {count}
        </p>
      ) : null}

      <style>{GALLERY_CSS}</style>
    </div>
  );

  return createPortal(node, window.document.body);
}

// Opacity and a whisper of scale on the photo only — never on a container that also carries
// layout, and with no fill mode. M26-F is the reason that sentence exists (see the runtime).
const GALLERY_CSS = `
@keyframes nest-gallery-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes nest-gallery-photo-in { from { opacity: 0; transform: scale(0.985) } to { opacity: 1; transform: none } }
.nest-gallery-in { animation: nest-gallery-in 180ms ease-out; }
.nest-gallery-photo { animation: nest-gallery-photo-in 220ms cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) {
  .nest-gallery-in, .nest-gallery-photo { animation: none; }
}
`;
