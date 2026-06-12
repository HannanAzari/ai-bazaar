import type { Collection, CollectionItem, SavedKind } from "@/lib/types";

// Demo collections. Stored in localStorage so saving works without a backend;
// production writes the same shape to the Supabase `collections` and
// `collection_items` tables (see schema.sql).

const STORAGE_KEY = "ai-bazaar-collections";

export type SaveTarget = {
  kind: SavedKind;
  shopAddress: string;
  itemId?: string;
  label: string;
};

type Store = { collections: Collection[]; items: CollectionItem[] };

const DEFAULT_NAMES = ["Favorite houses", "Inspiration", "Want to visit"];

function read(): Store {
  if (typeof window === "undefined") return { collections: [], items: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Store | null;
    return parsed ?? { collections: [], items: [] };
  } catch {
    return { collections: [], items: [] };
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("ai-bazaar-collections-changed"));
}

function identity(target: { kind: SavedKind; shopAddress: string; itemId?: string }): string {
  return `${target.kind}:${target.shopAddress}:${target.itemId ?? ""}`;
}

/** Create the three starter collections the first time collections are used. */
export function ensureSeeded(): Collection[] {
  const store = read();
  if (store.collections.length > 0) return store.collections;
  const now = Date.now();
  store.collections = DEFAULT_NAMES.map((name, index) => ({
    id: `col-default-${index}`,
    name,
    isDefault: true,
    createdAt: new Date(now - index).toISOString(),
  }));
  write(store);
  return store.collections;
}

export function getCollections(): Collection[] {
  return read().collections;
}

export function getItems(collectionId: string): CollectionItem[] {
  return read().items
    .filter((item) => item.collectionId === collectionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function totalSaved(): number {
  return read().items.length;
}

export function createCollection(name: string): Collection | null {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return null;
  const store = read();
  const collection: Collection = {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };
  store.collections = [...store.collections, collection];
  write(store);
  return collection;
}

/** Collection ids that already contain a given target. */
export function collectionsContaining(target: { kind: SavedKind; shopAddress: string; itemId?: string }): string[] {
  const key = identity(target);
  return read()
    .items.filter((item) => identity(item) === key)
    .map((item) => item.collectionId);
}

/** Add the target to a collection, or remove it if already there. Returns true if now saved. */
export function toggleInCollection(collectionId: string, target: SaveTarget): boolean {
  const store = read();
  const key = identity(target);
  const existing = store.items.find((item) => item.collectionId === collectionId && identity(item) === key);
  if (existing) {
    store.items = store.items.filter((item) => item.id !== existing.id);
    write(store);
    return false;
  }
  store.items = [
    ...store.items,
    {
      id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      collectionId,
      kind: target.kind,
      shopAddress: target.shopAddress,
      itemId: target.itemId,
      label: target.label,
      createdAt: new Date().toISOString(),
    },
  ];
  write(store);
  return true;
}

export function removeItem(itemId: string) {
  const store = read();
  store.items = store.items.filter((item) => item.id !== itemId);
  write(store);
}
