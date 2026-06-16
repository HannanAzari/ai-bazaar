import { describe, it, expect } from "vitest";
import {
  toNestudioAsset,
  approvedCatalog,
  exportJson,
  exportTs,
} from "@/lib/export";
import { sampleCandidates } from "@/lib/sample-data";
import committed from "@/exports/approved-assets.json";

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
    expect(approved.length).toBe(5);
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
