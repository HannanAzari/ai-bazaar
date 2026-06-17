import { type StyleSample } from "@/lib/types";

// Local-only persistence for Style Lab samples (V3.1). Calibration is a one-time,
// single-operator decision, so it lives in localStorage (not the shared backend).
// SSR-guarded, try/catch, change event — same shape as the other local stores.

const KEY = "nestudio-asset-factory-style-lab";
export const STYLE_LAB_CHANGE_EVENT = "nestudio-asset-factory-style-lab-changed";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function emitChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STYLE_LAB_CHANGE_EVENT));
}

export function loadStyleSamples(): StyleSample[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as StyleSample[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStyleSamples(samples: StyleSample[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(samples.slice(0, 500)));
    emitChange();
  } catch {
    // ignore
  }
}

/** Replace all samples for an item with a fresh batch, then persist. */
export function replaceItemSamples(all: StyleSample[], itemKey: string, fresh: StyleSample[]): StyleSample[] {
  const updated = [...all.filter((s) => s.itemKey !== itemKey), ...fresh];
  saveStyleSamples(updated);
  return updated;
}

export function resetStyleLab(): StyleSample[] {
  if (canUseStorage()) {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
  emitChange();
  return [];
}
