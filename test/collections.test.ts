import { describe, it, expect } from "vitest";
import {
  collectionsContaining,
  createCollection,
  ensureSeeded,
  getCollections,
  getItems,
  removeItem,
  toggleInCollection,
  totalSaved,
} from "@/lib/collections";

const target = { kind: "house" as const, shopAddress: "saffron.tiny.lantern", label: "The Quiet Kettle" };

describe("collections", () => {
  it("seeds three default collections, idempotently", () => {
    expect(ensureSeeded()).toHaveLength(3);
    expect(ensureSeeded()).toHaveLength(3);
    expect(getCollections().every((c) => c.isDefault)).toBe(true);
  });

  it("toggles a target in and out of a collection", () => {
    const [fav] = ensureSeeded();
    expect(collectionsContaining(target)).toEqual([]);
    expect(toggleInCollection(fav.id, target)).toBe(true);
    expect(collectionsContaining(target)).toEqual([fav.id]);
    expect(getItems(fav.id)).toHaveLength(1);
    expect(toggleInCollection(fav.id, target)).toBe(false);
    expect(collectionsContaining(target)).toEqual([]);
  });

  it("creates collections and removes saved items", () => {
    ensureSeeded();
    const col = createCollection("Test shelf");
    expect(col).not.toBeNull();
    if (!col) return;
    toggleInCollection(col.id, target);
    expect(totalSaved()).toBe(1);
    const [item] = getItems(col.id);
    removeItem(item.id);
    expect(totalSaved()).toBe(0);
  });
});
