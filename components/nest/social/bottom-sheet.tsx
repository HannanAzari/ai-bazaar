"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { z } from "@/lib/nest-layers";

// M18 — a cozy mobile bottom sheet (slides up, backdrop, grab handle). Used for
// comments + the sign-in gate. Instagram/TikTok feel, warm Nestudio surface — not a
// forum page. Esc / backdrop / close all dismiss.
//
// Day 3.4 — header cleanup: the grab handle now sits CENTRED on its own row at the very
// top, with the title and close button on the row beneath it. Focus moves in on open.
//
// ── M24 §2 — PORTALLED, and that is the whole layering fix ───────────────────
//
// A `z-index` only means anything inside its own stacking context, and this sheet used to
// render wherever it was mounted. The owner "…" menu lives inside the full-Nest header,
// which is `absolute z-40` — a positioned element with a z-index, i.e. a stacking context.
// So the sheet's `z-60` meant "60 within that header", and the engagement rail (same
// layer, later in the DOM) painted straight over it. Identically on Home: the sheet was
// scoped inside a feed card, so card metadata and the fixed bottom nav sat above it.
//
// Rendering into `document.body` puts the sheet in the ROOT stacking context, where the
// layer tokens in lib/nest-layers.ts actually mean what they say. `CenteredModal` already
// did this; the sheet not doing it is the bug behind every "bleeding through" report.
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus into the sheet so keyboard/AT users land inside it, not behind it.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => panel.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Lock the page behind the sheet. Without this the feed keeps scrolling under your
  // finger when a drag starts on the backdrop, which reads as the sheet "slipping".
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // NOTE on the animation below: it deliberately has NO `fill-mode`.
  //
  // It used to be `both`, which holds the FROM keyframe (`opacity: 0`,
  // `translateY(100%)`) whenever the animation is not actively advancing — a throttled
  // background tab, a low-power device, or an automated browser. The sheet then sits
  // entirely below the fold, fully interactive but invisible and untappable. Caught while
  // probing the overlay stack: the panel measured `top = viewportH` with the animation
  // stuck at `currentTime: 0`.
  //
  // Without a fill-mode the resting state is the natural one, so a sheet that fails to
  // animate is simply a sheet that appears instantly — the safe direction.

  // ── §4 — iOS keyboard ──────────────────────────────────────────────────────
  //
  // On iOS Safari the software keyboard does NOT resize the layout viewport, so a sheet
  // pinned to the bottom of `100dvh` ends up underneath it and the comment composer you
  // just tapped becomes invisible. `visualViewport` reports the keyboard's height, and
  // lifting the sheet by that amount keeps the input on screen.
  //
  // Guarded for browsers without the API (and for the server), where it is a no-op.
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      // How much of the layout viewport the keyboard is covering.
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardInset(Math.max(0, Math.round(covered)));
    };
    onResize();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
      setKeyboardInset(0);
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className={`sheet-fade fixed inset-0 ${z.drawer} flex items-end justify-center bg-black/40 sm:items-center`} onClick={onClose}>
      <style>{`@keyframes sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } } .sheet-up { animation: sheet-up .38s cubic-bezier(.32,.72,0,1) } @keyframes sheet-fade { from { opacity: 0 } to { opacity: 1 } } .sheet-fade { animation: sheet-fade .3s ease-out } @media (prefers-reduced-motion: reduce) { .sheet-up, .sheet-fade { animation: none } }`}</style>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // §12 — content-aware height: tall enough to be usable, never a full-screen page
        // for a single comment. The list inside scrolls; the composer stays pinned.
        className="sheet-up flex max-h-[80dvh] min-h-[38dvh] w-full max-w-md flex-col rounded-t-3xl border border-timber/15 bg-parchment shadow-lift outline-none sm:min-h-0 sm:rounded-3xl"
        style={{
          // With the keyboard open we lift by its height instead of the safe-area inset —
          // the home indicator is behind the keyboard, so adding both would double-pad.
          marginBottom: keyboardInset ? `${keyboardInset}px` : undefined,
          paddingBottom: keyboardInset ? 0 : "env(safe-area-inset-bottom)",
          // Shrink so the sheet still fits above the keyboard rather than being clipped.
          maxHeight: keyboardInset ? `calc(80dvh - ${keyboardInset}px)` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* row 1 — the grab handle, centred and alone (mobile only) */}
        <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink/15 sm:hidden" />
        {/* row 2 — title left, close right */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-2.5">
          {title ? <h2 className="text-sm font-black text-ink">{title}</h2> : <span />}
          <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-ink/50 hover:bg-white/60"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
