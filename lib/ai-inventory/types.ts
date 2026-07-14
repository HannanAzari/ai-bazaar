/**
 * lib/ai-inventory/types.ts — the inventory contract.
 * -----------------------------------------------------------------------------
 * Approved AI assets live here and flow straight into the editor's asset picker.
 * The store interface is deliberately backend-agnostic: `LocalInventoryStore`
 * (localStorage) ships in M20, and a `SupabaseInventoryStore` can implement the
 * SAME interface later with no change to studios, the picker, or this file. The
 * Admin Asset Factory reuses it too — the only difference is a store whose
 * `target` is `globalLibrary` instead of `inventory`.
 */

import type { AssetKind, AssetMetadata, PublishTarget } from "@/lib/ai/types";

/** One saved asset — engine-native (no editor types), so every studio can produce
 *  one and any surface can consume it. */
export type InventoryAsset = {
  id: string;
  kind: AssetKind;
  name: string;
  tags: string[];
  /** Transparent PNG. A data URL today; a hosted URL once a backend store lands. */
  imageUrl: string;
  width: number;
  height: number;
  createdAt: string;
  publishTarget: PublishTarget;
  metadata: AssetMetadata;
};

/**
 * A reactive asset store. Mutations are async (so a network backend fits);
 * reads are a synchronous snapshot + subscription (so React can render via
 * useSyncExternalStore without tearing). A Supabase store keeps an in-memory
 * cache hydrated from the network behind exactly this shape.
 */
export interface InventoryStore {
  /** Where approved assets from this store go. */
  readonly target: PublishTarget;
  /** Current assets, newest first. Stable reference between changes. */
  getSnapshot(): InventoryAsset[];
  get(id: string): InventoryAsset | undefined;
  save(asset: InventoryAsset): Promise<InventoryAsset>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  /** Subscribe to changes; returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
}
