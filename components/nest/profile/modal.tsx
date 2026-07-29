"use client";
import { z } from "@/lib/nest-layers";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Day 3.4 — a centred modal for the focused avatar interactions (owner editor, visitor
// preview). Bottom sheets are for lists of actions; a profile photo wants the middle of the
// screen. Escape / backdrop / close dismiss; focus moves in on open and returns on close.
export function CenteredModal({
  open,
  onClose,
  title,
  children,
  tone = "light",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** "dark" = a blurred dark backdrop with no panel chrome (image preview). */
  tone?: "light" | "dark";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => panel.current?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Portal to <body>: the identity card uses backdrop-blur, which makes it a containing
  // block for fixed-position descendants — without this the modal is clipped to the card.
  return createPortal(
    <div
      className={`modal-fade fixed inset-0 ${z.modal} flex items-center justify-center p-5 ${tone === "dark" ? "bg-black/70 backdrop-blur-sm" : "bg-black/40"}`}
      onClick={onClose}
    >
      <style>{`@keyframes modal-fade { from { opacity: 0 } to { opacity: 1 } } .modal-fade { animation: modal-fade .22s ease-out } @keyframes modal-pop { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } } .modal-pop { animation: modal-pop .26s cubic-bezier(.32,.72,0,1) } @media (prefers-reduced-motion: reduce) { .modal-fade, .modal-pop { animation: none } }`}</style>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`modal-pop w-full max-w-[320px] outline-none ${tone === "dark" ? "" : "rounded-3xl border border-timber/15 bg-parchment p-5 shadow-lift"}`}
      >
        {tone === "light" ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            {title ? <h2 className="text-sm font-black text-ink">{title}</h2> : <span />}
            <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-ink/50 hover:bg-white/60"><X className="size-5" /></button>
          </div>
        ) : (
          <button onClick={onClose} aria-label="Close" className="mb-3 ml-auto flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"><X className="size-5" /></button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
