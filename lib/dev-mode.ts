"use client";

/**
 * lib/dev-mode.ts — a tiny developer-mode flag.
 * -----------------------------------------------------------------------------
 * Gates internal tools (the AI review panel → future Admin Asset Factory) behind
 * a local toggle, so they never show for normal users. On via `?dev=1` or the
 * Studio's Dev toggle; persisted in localStorage.
 */

import { useSyncExternalStore } from "react";

const KEY = "nestudio:devmode";
const EVENT = "nestudio:devmode:changed";

export function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("dev") === "1") return true;
  return window.localStorage.getItem(KEY) === "1";
}

export function setDevMode(on: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useDevMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    () => isDevMode(),
    () => false,
  );
}
