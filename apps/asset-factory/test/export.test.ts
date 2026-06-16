import { describe, it, expect } from "vitest";
import {
  toNestudioAsset,
  approvedCatalog,
  exportJson,
  exportTs,
  exportPacksJson,
  packsForExport,
} from "@/lib/export";
import { sampleCandidates } from "@/lib/sample-data";
import { buildSamplePacks } from "@/lib/sample-packs";
import committed from "@/exports/approved-assets.json";
import committedPacks from "@/exports/asset-packs.json";

describe("export to Nestudio", () => {
  it("maps a candidate to the Nestudio catalog shape", () => {
    const c = sampleCandidates().find((x) => x.slug === "cozy-reading-chair")!;
    const asset = toNestudioAsset(c);
    expect(asset.id).toBe("ast-cozy-reading-chair");
    expect(asset.category).toBe("furniture");
    expect(asset.ownerType).toBe("system");
    expect(asset.status).toBe("published");
    expect(asset.villageTheme).toBe("any");
    expect(asset.compatibleZones).toContain("floor_left");
  });

  it("only exports approved candidates", () => {
    const all = sampleCandidates();
    const approved = approvedCatalog(all);
    expect(approved.length).toBe(all.filter((c) => c.status === "approved").length);
    expect(approved.length).toBeGreaterThan(0);
    // Every exported asset is published and has a stable ast- id.
    expect(approved.every((a) => a.status === "published" && a.id.startsWith("ast-"))).toBe(true);
  });

  it("is sorted by id (deterministic)", () => {
    const ids = approvedCatalog(sampleCandidates()).map((a) => a.id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it("matches the committed exports/approved-assets.json", () => {
    expect(approvedCatalog(sampleCandidates())).toEqual(committed);
  });

  it("exportJson is valid JSON round-tripping the catalog", () => {
    const parsed = JSON.parse(exportJson(sampleCandidates()));
    expect(parsed).toEqual(committed);
  });

  it("exportTs emits a module exporting every approved id", () => {
    const ts = exportTs(sampleCandidates());
    expect(ts).toContain("export const approvedAssets");
    for (const a of approvedCatalog(sampleCandidates())) {
      expect(ts).toContain(a.id);
    }
  });
});

describe("pack export", () => {
  const candidates = sampleCandidates();
  const packs = buildSamplePacks(candidates);

  it("resolves a pack's approved members to ast- ids, sorted", () => {
    const exported = packsForExport(packs, candidates);
    expect(exported).toHaveLength(packs.length);
    const cozy = exported.find((p) => p.slug === "cozy-creator")!;
    expect(cozy.assetCount).toBe(cozy.assets.length);
    expect(cozy.assets.length).toBeGreaterThan(0);
    expect(cozy.assets.every((id) => id.startsWith("ast-"))).toBe(true);
    expect(cozy.assets).toEqual([...cozy.assets].sort((a, b) => a.localeCompare(b)));
  });

  it("excludes non-approved members from a pack export", () => {
    const [first] = packs;
    // Inject a non-approved id; it must not appear in the export.
    const dirty = { ...first, assetIds: [...first.assetIds, "definitely-not-approved"] };
    const exported = packsForExport([dirty], candidates);
    expect(exported[0].assets).not.toContain("definitely-not-approved");
    expect(exported[0].assetCount).toBe(exported[0].assets.length);
  });

  it("matches the committed exports/asset-packs.json", () => {
    const parsed = JSON.parse(exportPacksJson(packs, candidates));
    expect(parsed).toEqual(committedPacks);
  });
});
