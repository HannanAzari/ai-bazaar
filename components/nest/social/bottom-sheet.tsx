"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// M18 — a cozy mobile bottom sheet (slides up, backdrop, grab handle). Used for
// comments + the sign-in gate. Instagram/TikTok feel, warm Nestudio surface — not a
// forum page. Esc / backdrop / close all dismiss.
//
// Day 3.4 — header cleanup: the grab handle now sits CENTRED on its own row at the very
// top, with the title and close button on the row beneath it (it used to sit beside the
// title, which read as accidental). Focus moves into the sheet on open.
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

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

  if (!open) return null;
  return (
    <div className="sheet-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <style>{`@keyframes sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } } .sheet-up { animation: sheet-up .38s cubic-bezier(.32,.72,0,1) both } @keyframes sheet-fade { from { opacity: 0 } to { opacity: 1 } } .sheet-fade { animation: sheet-fade .3s ease-out both } @media (prefers-reduced-motion: reduce) { .sheet-up, .sheet-fade { animation: none } }`}</style>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-up flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl border border-timber/15 bg-parchment shadow-lift outline-none sm:rounded-3xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* row 1 — the grab handle, centred and alone (mobile only) */}
        <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink/15 sm:hidden" />
        {/* row 2 — title left, close right */}
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-2.5">
          {title ? <h2 className="text-sm font-black text-ink">{title}</h2> : <span />}
          <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-ink/50 hover:bg-white/60"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
