"use client";

/**
 * lib/ai-inventory/react.ts — reactive React binding for any InventoryStore.
 * -----------------------------------------------------------------------------
 * `useInventory()` subscribes a component to the inventory via useSyncExternalStore
 * so the Studio and the editor picker both stay live as assets are saved/removed —
 * across tabs too. Works with the local store today and any InventoryStore later.
 */

import { useSyncExternalStore } from "react";
import { inventory } from "./index";
import type { InventoryAsset, InventoryStore } from "./types";

export function useInventory(store: InventoryStore = inventory): InventoryAsset[] {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot(),
    () => EMPTY,
  );
}

const EMPTY: InventoryAsset[] = [];
