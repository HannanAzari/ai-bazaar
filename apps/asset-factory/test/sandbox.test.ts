import { describe, it, expect } from "vitest";
import { generateSandboxRoom, type SandboxCreatorType } from "@/lib/sandbox";
import { buildSamplePacks } from "@/lib/sample-packs";
import { sampleCandidates } from "@/lib/sample-data";
import { CATEGORY_META } from "@/lib/types";
import { categoryAllowedInZone, zoneDef } from "@/lib/zones";

const candidates = sampleCandidates();
const packs = buildSamplePacks(candidates);

describe("room designer sandbox", () => {
  it("is deterministic for the same input", () => {
    const a = generateSandboxRoom({ candidates, creatorType: "cozy_creator", style: "cozy" });
    const b = generateSandboxRoom({ candidates, creatorType: "cozy_creator", style: "cozy" });
    expect(a.placements.map((p) => `${p.assetId}@${p.zoneType}`)).toEqual(
      b.placements.map((p) => `${p.assetId}@${p.zoneType}`),
    );
  });

  it("only ever places approved assets", () => {
    const approvedIds = new Set(candidates.filter((c) => c.status === "approved").map((c) => c.id));
    const result = generateSandboxRoom({ candidates, creatorType: "startup", style: "professional" });
    expect(result.placements.every((p) => approvedIds.has(p.assetId))).toBe(true);
  });

  it("every placement respects category↔zone rules and capacity", () => {
    const result = generateSandboxRoom({ candidates, creatorType: "photographer", style: "creative" });
    for (const p of result.placements) {
      const meta = CATEGORY_META[p.category];
      expect(categoryAllowedInZone(meta.nestudioCategory, p.zoneType)).toBe(true);
    }
    for (const z of result.zoneUsage) {
      expect(z.used).toBeLessThanOrEqual(z.max);
      expect(z.max).toBe(zoneDef(z.zoneType)!.maxObjects);
    }
  });

  it("restricts the pool to a chosen pack", () => {
    const pack = packs.find((p) => p.slug === "cafe")!;
    const result = generateSandboxRoom({ candidates, creatorType: "cafe", style: "cozy", packAssetIds: pack.assetIds });
    const packApproved = candidates.filter((c) => pack.assetIds.includes(c.id) && c.status === "approved").length;
    expect(result.poolSize).toBe(packApproved);
    const allowed = new Set(pack.assetIds);
    expect(result.placements.every((p) => allowed.has(p.assetId))).toBe(true);
  });

  it("generates a non-empty room for each of the five packs", () => {
    const pairing: [string, SandboxCreatorType][] = [
      ["cozy-creator", "cozy_creator"],
      ["photographer-studio", "photographer"],
      ["podcaster", "podcaster"],
      ["cafe", "cafe"],
      ["startup-workspace", "startup"],
    ];
    for (const [slug, creatorType] of pairing) {
      const pack = packs.find((p) => p.slug === slug)!;
      const result = generateSandboxRoom({ candidates, creatorType, style: "cozy", packAssetIds: pack.assetIds });
      expect(result.placements.length).toBeGreaterThan(0);
    }
  });
});
