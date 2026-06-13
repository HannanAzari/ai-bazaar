// A tiny, pure undo/redo stack. The room editor keeps one of these in state so
// add / delete / move / resize / duplicate / layer changes are reversible
// (Cmd+Z / Cmd+Shift+Z). It is deliberately generic and side-effect free so it
// is trivial to test.

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
};

/** Cap so a long editing session can't grow the stack without bound. */
export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Record a new present, pushing the old one onto the undo stack and clearing
 * the redo stack (a fresh edit invalidates any redo). */
export function pushHistory<T>(history: History<T>, present: T): History<T> {
  const past = [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present, future: [] };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: history.future.slice(1),
  };
}
