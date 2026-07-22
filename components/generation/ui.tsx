"use client";

import type { CSSProperties, ReactNode } from "react";

// Shared presentational primitives for the Generation Platform. Previously duplicated
// verbatim in asset-factory-client and nest-factory-client — now defined once, used by
// the shared Studio and by every module's render slots.

export const CHECKER: CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#e3e3e3 25%,transparent 0),linear-gradient(-45deg,#e3e3e3 25%,transparent 0),linear-gradient(45deg,transparent 75%,#e3e3e3 0),linear-gradient(-45deg,transparent 75%,#e3e3e3 0)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
  backgroundColor: "#f4f4f4",
};

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500">{children}</div>;
}

export function Spinner({ children }: { children: ReactNode }) {
  return (
    <Centered>
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />
        {children}
      </div>
    </Centered>
  );
}

export function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-neutral-400">{k}</span>
      <div className="font-semibold text-neutral-800">{v}</div>
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
      <p className="mb-1 text-[9px] uppercase tracking-wide text-neutral-400">{label}</p>
      <div style={checker ? CHECKER : { background: "#fff" }} className="aspect-square overflow-hidden rounded-lg border border-neutral-200">
        {src ? (
          <span className="flex h-full w-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className={small ? "h-1/2 w-1/2 object-contain" : "h-full w-full object-contain"} />
          </span>
        ) : (
          <span className="flex h-full items-center justify-center text-[9px] text-neutral-300">—</span>
        )}
      </div>
    </div>
  );
}

export function StickyBar({ children }: { children: ReactNode }) {
  if (!children || (Array.isArray(children) && children.every((c) => !c))) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2 border-t border-neutral-100 bg-white/95 px-4 pt-3 backdrop-blur"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}

export function Primary({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex-[2] rounded-2xl bg-neutral-900 py-3.5 text-sm font-bold text-white disabled:opacity-30">
      {children}
    </button>
  );
}

export function Secondary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-1 rounded-2xl border border-neutral-200 py-3.5 text-sm font-semibold text-neutral-700">
      {children}
    </button>
  );
}
