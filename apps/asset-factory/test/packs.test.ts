import { describe, it, expect } from "vitest";
import { createLocalRepository } from "@/lib/repo/local";
import { buildSamplePacks } from "@/lib/sample-packs";
import { sampleCandidates } from "@/lib/sample-data";
import { type AssetPack } from "@/lib/types";

const repo = createLocalRepository();

function newPack(over: Partial<AssetPack> = {}): AssetPack {
  return {
    id: "pack-test",
    slug: "test-pack",
    name: "Test Pack",
    description: "A pack for testing",
    theme: "test",
    status: "draft",
    assetIds: [],
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("sample packs", () => {
  it("builds five starter packs with approved members", () => {
    const packs = buildSamplePacks(sampleCandidates());
    expect(packs).toHaveLength(5);
    expect(packs.map((p) => p.slug)).toEqual([
      "cozy-creator",
      "photographer-studio",
      "podcaster",
      "cafe",
      "startup-workspace",
    ]);
    for (const pack of packs) {
      expect(pack.assetIds.length).toBeGreaterThan(0);
      expect(pack.status).toBe("ready");
    }
  });

  it("only references approved candidate ids", () => {
    const candidates = sampleCandidates();
    const approvedIds = new Set(candidates.filter((c) => c.status === "approved").map((c) => c.id));
    for (const pack of buildSamplePacks(candidates)) {
      expect(pack.assetIds.every((id) => approvedIds.has(id))).toBe(true);
    }
  });
});

describe("local pack repository", () => {
  it("seeds the five starter packs on first list", async () => {
    expect(await repo.listPacks()).toHaveLength(5);
  });

  it("creates a new pack", async () => {
    await repo.savePack(newPack({ id: "pack-new", slug: "new" }));
    const packs = await repo.listPacks();
    expect(packs.find((p) => p.id === "pack-new")?.name).toBe("Test Pack");
  });

  it("edits an existing pack (name + status)", async () => {
    await repo.savePack(newPack({ id: "pack-edit" }));
    await repo.savePack(newPack({ id: "pack-edit", name: "Renamed", status: "ready" }));
    const pack = (await repo.listPacks()).find((p) => p.id === "pack-edit")!;
    expect(pack.name).toBe("Renamed");
    expect(pack.status).toBe("ready");
  });

  it("assigns and unassigns assets", async () => {
    const ids = (await repo.list()).slice(0, 3).map((c) => c.id);
    await repo.savePack(newPack({ id: "pack-assign", assetIds: ids }));
    expect((await repo.listPacks()).find((p) => p.id === "pack-assign")?.assetIds).toEqual(ids);
    await repo.savePack(newPack({ id: "pack-assign", assetIds: ids.slice(0, 1) }));
    expect((await repo.listPacks()).find((p) => p.id === "pack-assign")?.assetIds).toHaveLength(1);
  });

  it("deletes a pack", async () => {
    await repo.savePack(newPack({ id: "pack-del" }));
    await repo.deletePack("pack-del");
    expect((await repo.listPacks()).some((p) => p.id === "pack-del")).toBe(false);
  });
});
