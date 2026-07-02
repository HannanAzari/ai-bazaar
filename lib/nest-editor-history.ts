// ── Nestudio V2 — Nest Editor undo/redo history (M6) ────────────────────────
//
// A tiny, generic, framework-independent past/present/future history with a bounded
// stack. Pure: every function returns a NEW history. The editor pushes ONE entry per
// completed gesture (e.g. at pointer-up, not during the drag), and a new push clears
// the redo (future) stack. Unit-tested independently of React.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Max retained past states (older states are dropped). */
  limit: number;
}

export function createHistory<T>(present: T, limit = 50): History<T> {
  return { past: [], present, future: [], limit: Math.max(1, limit) };
}

/** Commit a new present; the previous present moves to `past`, `future` is cleared. */
export function pushHistory<T>(h: History<T>, next: T): History<T> {
  const past = [...h.past, h.present];
  // Bound the past stack (drop oldest beyond the limit).
  const trimmed = past.length > h.limit ? past.slice(past.length - h.limit) : past;
  return { past: trimmed, present: next, future: [], limit: h.limit };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}

/** Step back: present → future, last past → present. */
export function undoHistory<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1];
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
    limit: h.limit,
  };
}

/** Step forward: present → past, first future → present. */
export function redoHistory<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const next = h.future[0];
  return {
    past: [...h.past, h.present],
    present: next,
    future: h.future.slice(1),
    limit: h.limit,
  };
}
