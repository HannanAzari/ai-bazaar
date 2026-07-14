/**
 * lib/ai-inventory — the local inventory singleton + public surface.
 * -----------------------------------------------------------------------------
 * `inventory` is the app-wide user store (localStorage today). Swapping to
 * Supabase later means constructing a different InventoryStore here; every caller
 * (Studio, editor picker) is unaffected.
 */

import { LocalInventoryStore } from "./local-store";
import type { InventoryStore } from "./types";

export * from "./types";
export { LocalInventoryStore, assetFromGenerated } from "./local-store";

/** The user's approved-asset store. */
export const inventory: InventoryStore = new LocalInventoryStore({ target: "inventory" });

/** Resolve the store for a publish target. The Admin Asset Factory registers a
 *  `globalLibrary` store here later — same interface, different destination. */
export function getInventory(): InventoryStore {
  return inventory;
}
