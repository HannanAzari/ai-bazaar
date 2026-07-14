/**
 * lib/ai-inventory/local-store.ts — localStorage implementation of InventoryStore.
 * -----------------------------------------------------------------------------
 * Mirrors the app's existing local-persistence conventions (see
 * lib/nest-document-store.ts): a namespaced key, an isBrowser guard, JSON
 * read/write, a change CustomEvent, and cross-tab `storage` sync. Bounded to the
 * newest N assets so the data-URL PNGs can't blow the localStorage quota — the
 * documented path off this cap is IndexedDB for blobs + a Supabase row per asset,
 * both behind the same InventoryStore interface.
 */

import type { GeneratedAsset, PublishTarget } from "@/lib/ai/types";
import type { InventoryAsset, InventoryStore } from "./types";

const KEY = "nestudio-ai-inventory";
const CHANGED_EVENT = "nestudio:ai-inventory:changed";
const MAX_ASSETS = 40; // keep newest N; bounds localStorage usage

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Turn a freshly generated asset into a savable inventory record. */
export function assetFromGenerated(generated: GeneratedAsset, target: PublishTarget = "inventory"): InventoryAsset {
  return {
    id: generated.id,
    kind: generated.kind,
    name: generated.metadata.name,
    tags: generated.metadata.prompt.tags,
    imageUrl: generated.png.dataUrl,
    width: generated.png.width,
    height: generated.png.height,
    createdAt: generated.metadata.createdAt,
    publishTarget: target,
    metadata: generated.metadata,
  };
}

export class LocalInventoryStore implements InventoryStore {
  readonly target: PublishTarget;
  private cache: InventoryAsset[];
  private listeners = new Set<() => void>();
  private storageKey: string;

  constructor(opts: { target?: PublishTarget; key?: string } = {}) {
    this.target = opts.target ?? "inventory";
    this.storageKey = opts.key ?? KEY;
    this.cache = this.read();
    if (isBrowser()) {
      window.addEventListener("storage", (e) => {
        if (e.key === this.storageKey) {
          this.cache = this.read();
          this.emit();
        }
      });
      window.addEventListener(CHANGED_EVENT, () => {
        this.cache = this.read();
        this.emit();
      });
    }
  }

  getSnapshot(): InventoryAsset[] {
    return this.cache;
  }

  get(id: string): InventoryAsset | undefined {
    return this.cache.find((a) => a.id === id);
  }

  async save(asset: InventoryAsset): Promise<InventoryAsset> {
    const next = [asset, ...this.cache.filter((a) => a.id !== asset.id)].slice(0, MAX_ASSETS);
    this.commit(next);
    return asset;
  }

  async remove(id: string): Promise<void> {
    this.commit(this.cache.filter((a) => a.id !== id));
  }

  async clear(): Promise<void> {
    this.commit([]);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /* ── internals ── */

  private read(): InventoryAsset[] {
    if (!isBrowser()) return [];
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      const parsed = raw ? (JSON.parse(raw) as InventoryAsset[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private commit(next: InventoryAsset[]): void {
    this.cache = next;
    if (isBrowser()) {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(next));
      } catch {
        // Quota exceeded — drop the oldest and retry once.
        try {
          window.localStorage.setItem(this.storageKey, JSON.stringify(next.slice(0, Math.max(1, next.length - 8))));
        } catch {
          /* give up silently; cache still reflects intent */
        }
      }
      window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
    }
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}
