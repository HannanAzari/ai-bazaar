"use client";

import { useEffect, useRef } from "react";
import { nestBackend } from "@/lib/nest-repo";
import { recordNestView } from "@/lib/nest/supabase-views-repo";

// ── M24 §2 — what counts as a view ───────────────────────────────────────────
//
// A view is "someone actually looked at this", not "a request happened". The guards below
// are each there for a specific way the count would otherwise be inflated:
//
//   • DWELL — the visitor must stay ~2.5s. Kills accidental taps and back-button bounces.
//   • VISIBILITY — a background tab doesn't count, and the timer restarts when the page is
//     hidden mid-dwell. Prefetches and background renders never become views.
//   • OWNER — the creator opening their own work doesn't count, so editing in a loop can't
//     manufacture an audience.
//   • ONE PER MOUNT — a re-render, a state change or a parent update cannot re-fire it.
//   • FULL VIEW ONLY — this hook is called from the full Nest and the Profile, never from
//     NestPreview, so thumbnails and feed cards can't count.
//
// Per-day deduplication is the database's job (a unique index); this is about honesty at
// the moment of counting.

/** How long the Nest must stay visible before it counts. */
export const VIEW_DWELL_MS = 2500;

const isSupabase = () => nestBackend() === "supabase";

type Options = {
  /** Wait until identity has resolved, so the owner check is trustworthy. */
  ready?: boolean;
  isOwner?: boolean;
  viewerId?: string;
  onCounted?: () => void;
};

function useDwellView(record: (() => Promise<boolean>) | null, options: Options) {
  const { ready = true, isOwner = false, onCounted } = options;
  const counted = useRef(false);

  useEffect(() => {
    if (!record || !ready || isOwner || counted.current) return;
    if (!isSupabase()) return; // demo backend has no shared counter to write to

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const start = () => {
      if (counted.current || document.hidden) return;
      timer = setTimeout(async () => {
        if (cancelled || counted.current || document.hidden) return;
        counted.current = true; // set BEFORE awaiting, so a re-entry can't double-count
        const isNew = await record();
        if (!cancelled && isNew) onCounted?.();
      }, VIEW_DWELL_MS);
    };

    // Restart the clock whenever visibility changes: a tab that was hidden for most of the
    // dwell has not been "viewed" for 2.5 seconds.
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden) start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [record, ready, isOwner, onCounted]);
}

/** Count a view of a published Nest, once the visitor has genuinely stayed. */
export function useRecordNestView(nestSlug: string | undefined, options: Options = {}) {
  const { viewerId } = options;
  const record = nestSlug ? () => recordNestView(nestSlug, viewerId) : null;
  useDwellView(record, options);
}
