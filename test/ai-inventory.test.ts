import { describe, it, expect, beforeEach } from "vitest";
import { LocalInventoryStore, assetFromGenerated } from "../lib/ai-inventory/local-store";
import type { InventoryAsset } from "../lib/ai-inventory/types";
import type { GeneratedAsset } from "../lib/ai/types";

function makeAsset(id: string): InventoryAsset {
  return {
    id,
    kind: "furniture",
    name: id,
    tags: ["furniture"],
    imageUrl: "data:image/png;base64,AAAA",
    width: 64,
    height: 64,
    createdAt: "2026-07-14T00:00:00.000Z",
    publishTarget: "inventory",
    metadata: {} as InventoryAsset["metadata"],
  };
}

describe("LocalInventoryStore", () => {
  let store: LocalInventoryStore;
  beforeEach(() => {
    store = new LocalInventoryStore({ target: "inventory", key: `test-${Math.round(Math.abs(Math.sin(1)) * 1e6)}` });
  });

  it("starts empty and saves newest-first", async () => {
    expect(store.getSnapshot()).toEqual([]);
    await store.save(makeAsset("a"));
    await store.save(makeAsset("b"));
    expect(store.getSnapshot().map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("save with an existing id de-dupes and moves it to front", async () => {
    await store.save(makeAsset("a"));
    await store.save(makeAsset("b"));
    await store.save(makeAsset("a"));
    expect(store.getSnapshot().map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("get / remove / clear behave", async () => {
    await store.save(makeAsset("a"));
    expect(store.get("a")?.id).toBe("a");
    await store.remove("a");
    expect(store.get("a")).toBeUndefined();
    await store.save(makeAsset("x"));
    await store.clear();
    expect(store.getSnapshot()).toEqual([]);
  });

  it("notifies subscribers on change", async () => {
    let hits = 0;
    const off = store.subscribe(() => { hits += 1; });
    await store.save(makeAsset("a"));
    await store.remove("a");
    expect(hits).toBe(2);
    off();
    await store.save(makeAsset("b"));
    expect(hits).toBe(2); // no more after unsubscribe
  });

  it("exposes its publish target (inventory vs globalLibrary)", () => {
    expect(store.target).toBe("inventory");
    expect(new LocalInventoryStore({ target: "globalLibrary", key: "t2" }).target).toBe("globalLibrary");
  });

  it("assetFromGenerated maps a generated asset into an inventory record", () => {
    const gen: GeneratedAsset = {
      id: "ai_1",
      kind: "furniture",
      png: { width: 100, height: 100, dataUrl: "data:image/png;base64,BBBB" },
      metadata: {
        id: "ai_1", kind: "furniture", name: "Coffee Mug", subject: "coffee mug",
        prompt: { kind: "furniture", subject: "coffee mug", positive: "", negative: "", style: {} as never, tags: ["furniture", "coffee"], params: {}, promptVersion: "furniture@2" },
        provider: "stub", source: { width: 800, height: 600 }, output: { width: 100, height: 100 },
        createdAt: "2026-07-14T00:00:00.000Z", pipeline: ["validate"], version: 1,
      },
      log: [],
    };
    const inv = assetFromGenerated(gen);
    expect(inv.id).toBe("ai_1");
    expect(inv.imageUrl).toBe("data:image/png;base64,BBBB");
    expect(inv.tags).toContain("coffee");
    expect(inv.publishTarget).toBe("inventory");
  });
});
