"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// M18 — a cozy mobile bottom sheet (slides up, backdrop, drag handle). Used for
// comments + the sign-in gate. Instagram/TikTok feel, warm Nestudio surface — not a
// forum page. Locks body scroll while open; Esc / backdrop / close all dismiss.
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <style>{`@keyframes sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } } .sheet-up { animation: sheet-up .38s cubic-bezier(.32,.72,0,1) both } @keyframes sheet-fade { from { opacity: 0 } to { opacity: 1 } } .sheet-fade { animation: sheet-fade .3s ease-out both } @media (prefers-reduced-motion: reduce) { .sheet-up, .sheet-fade { animation: none } }`}</style>
      <div
        className="sheet-up flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl border border-timber/15 bg-parchment shadow-lift sm:rounded-3xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <span className="mx-auto h-1 w-10 rounded-full bg-ink/15 sm:hidden" />
          {title ? <h2 className="absolute left-1/2 -translate-x-1/2 text-sm font-black text-ink sm:static sm:translate-x-0">{title}</h2> : null}
          <button onClick={onClose} aria-label="Close" className="ml-auto rounded-lg p-1 text-ink/50 hover:bg-white/60"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
