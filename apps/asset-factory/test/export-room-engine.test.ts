import { describe, it, expect } from "vitest";
import {
  goldenItem,
  realStyleSamples,
  buildStyleSamples,
  decideSample,
  approvedLibrary,
  approvedSamplesToCandidates,
} from "@/lib/style-lab";
import { realDnaSamples } from "@/lib/sofa-dna";
import { roomEngineCatalog, exportRoomEngineCatalog, approvedCatalog } from "@/lib/export";
import { CATEGORY_META, type StyleSample } from "@/lib/types";

/** Approved real OpenAI samples for sofa + chair + coffee table. */
function approvedCollection(): StyleSample[] {
  let all: StyleSample[] = [];
  for (const key of ["sofa", "chair", "coffee_table"]) {
    let s = realDnaSamples(key, [`https://o/${key}.png`], { provider: "openai", model: "gpt-image-1" });
    s = decideSample(s, s[0].id, "approved");
    all = [...all, ...s];
  }
  return all;
}

describe("export source-of-truth (V3.7.3) — room-engine catalog", () => {
  it("excludes old /samples placeholder + dry-run assets", () => {
    let dry = buildStyleSamples(goldenItem("sofa")!); // /samples/ placeholders
    dry = decideSample(dry, dry[0].id, "approved");   // even approved → still a placeholder
    const samples = [...approvedCollection(), ...dry];
    const lib = approvedSamplesToCandidates(samples, []);
    const json = exportRoomEngineCatalog(lib);
    expect(json).not.toContain("/samples/");
    expect(json.toLowerCase()).not.toContain("placeholder");
    // the real openai assets ARE present
    expect(json).toContain("https://o/sofa.png");
  });

  it("includes the real OpenAI approved assets", () => {
    const lib = approvedSamplesToCandidates(approvedCollection(), []);
    const cat = roomEngineCatalog(lib);
    expect(cat).toHaveLength(3);
    expect(cat.every((a) => a.modelProvider === "openai" && a.modelName === "gpt-image-1")).toBe(true);
    expect(cat.map((a) => a.imageUrl).sort()).toEqual([
      "https://o/chair.png", "https://o/coffee_table.png", "https://o/sofa.png",
    ]);
  });

  it("excludes rejected samples", () => {
    let s = realDnaSamples("sofa", ["https://o/a.png", "https://o/b.png"], { provider: "openai", model: "gpt-image-1" });
    s = decideSample(s, s[0].id, "approved");
    s = decideSample(s, s[1].id, "rejected");
    const lib = approvedSamplesToCandidates(s, []);
    expect(lib).toHaveLength(1);
    const cat = roomEngineCatalog(lib);
    expect(cat).toHaveLength(1);
    expect(cat.every((a) => a.imageUrl !== "https://o/b.png")).toBe(true);
  });

  it("excludes non-OpenAI (e.g. Replicate shootout) renders from the room-engine catalog", () => {
    let s = realStyleSamples(goldenItem("sofa")!, "nestudio_v2", ["https://r/rep.png"], { provider: "replicate", model: "flux" });
    s = decideSample(s, s[0].id, "approved");
    const lib = approvedSamplesToCandidates(s, []);
    expect(lib).toHaveLength(1);                 // still in the library
    expect(roomEngineCatalog(lib)).toHaveLength(0); // but NOT in the room-engine catalog
  });

  it("maps sofa/chair/table correctly into the room-engine shape (all required fields)", () => {
    const lib = approvedSamplesToCandidates(approvedCollection(), []);
    const cat = roomEngineCatalog(lib);
    expect(cat).toHaveLength(3);
    for (const a of cat) {
      expect(a.category).toBe("furniture"); // sofa, chair, table → furniture
      expect(a.villageTheme).toBe("any");
      expect(a.ownerType).toBe("system");
      expect(a.rarity).toBe("common");
      expect(a.status).toBe("published");
      expect(a.source).toBe("style_lab");
      expect(a.modelProvider).toBe("openai");
      expect(a.modelName).toBe("gpt-image-1");
      expect(a.personality).toBeTruthy();
      expect(a.id.startsWith("ast-")).toBe(true);
      expect(a.placement).toBeTruthy();
      expect((a.compatibleZones ?? []).length).toBeGreaterThan(0);
      expect(a.defaultScale ?? 0).toBeGreaterThan(0);
    }
    // category mapping sanity
    expect(CATEGORY_META.sofa.nestudioCategory).toBe("furniture");
    expect(CATEGORY_META.chair.nestudioCategory).toBe("furniture");
    expect(CATEGORY_META.table.nestudioCategory).toBe("furniture");
  });

  it("export count matches the visible Approved Library count", () => {
    const samples = approvedCollection();
    const visible = approvedLibrary(samples);      // what the panel renders
    const lib = approvedSamplesToCandidates(samples, []);
    expect(lib).toHaveLength(visible.length);
    expect(approvedCatalog(lib)).toHaveLength(visible.length);
    expect(roomEngineCatalog(lib)).toHaveLength(visible.length);
  });
});
