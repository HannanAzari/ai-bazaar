"use client";

import type { CSSProperties, ReactNode } from "react";

// Shared presentational primitives for the Generation Platform — one warm, premium Nestudio
// look across Avatar, Asset and Nest studios. Neutral "admin" greys replaced with the app's
// parchment/terracotta/ink/timber palette so the studios feel like the product.

export const CHECKER: CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#efe7d6 25%,transparent 0),linear-gradient(-45deg,#efe7d6 25%,transparent 0),linear-gradient(45deg,transparent 75%,#efe7d6 0),linear-gradient(-45deg,transparent 75%,#efe7d6 0)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
  backgroundColor: "#faf6ee",
};

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[46vh] items-center justify-center text-sm text-ink/55">{children}</div>;
}

// A calm, premium loader — a soft breathing ring + the current emotional message.
export function Spinner({ children }: { children: ReactNode }) {
  return (
    <Centered>
      <div className="text-center">
        <div className="relative mx-auto mb-4 h-12 w-12">
          <span className="absolute inset-0 animate-ping rounded-full bg-terracotta/20" />
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-terracotta/25 border-t-terracotta" />
        </div>
        <p className="text-[15px] font-semibold text-ink/70">{children}</p>
      </div>
    </Centered>
  );
}

export function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-parchment/60 px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-ink/40">{k}</span>
      <div className="font-semibold text-ink">{v}</div>
    </div>
  );
}

export function Warn({ ok, label, note }: { ok: boolean; label: string; note: string }) {
  return (
    <div className={`rounded-xl px-3 py-2 text-[11px] ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      <b>{label}:</b> {ok ? "✓ " : "⚠ "}
      {note}
    </div>
  );
}

export function Thumb({ label, src, checker, small }: { label: string; src: string | null; checker?: boolean; small?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-wide text-ink/40">{label}</p>
      <div style={checker ? CHECKER : { background: "#fff" }} className="aspect-square overflow-hidden rounded-xl border border-timber/15">
        {src ? (
          <span className="flex h-full w-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className={small ? "h-1/2 w-1/2 object-contain" : "h-full w-full object-contain"} />
          </span>
        ) : (
          <span className="flex h-full items-center justify-center text-[9px] text-ink/25">—</span>
        )}
      </div>
    </div>
  );
}

export function StickyBar({ children }: { children: ReactNode }) {
  if (!children || (Array.isArray(children) && children.every((c) => !c))) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2 border-t border-timber/10 bg-parchment/90 px-4 pt-3 backdrop-blur-xl"
      style={{ paddingBottom: "calc(0.85rem + env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}

export function Primary({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex-[2] rounded-2xl bg-terracotta py-3.5 text-sm font-black text-parchment shadow-soft transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none">
      {children}
    </button>
  );
}

export function Secondary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-1 rounded-2xl border border-timber/20 bg-white py-3.5 text-sm font-bold text-ink/70 transition active:scale-[0.98]">
      {children}
    </button>
  );
}
