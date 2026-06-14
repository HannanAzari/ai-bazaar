import { describe, it, expect } from "vitest";
import {
  CREATOR_PRESETS,
  DESIGN_INTENTS,
  DESIGN_STYLES,
  describeConstraints,
  generateRoomDesign,
  matchIntent,
  parseBrief,
  scoreAssets,
  tokenize,
} from "@/lib/ai-room-designer";
import { findZone, validatePlacement } from "@/lib/room-schema";
import { getAsset } from "@/lib/assets";
import type { Room } from "@/lib/types";

const ADDRESS = "moon.test.room";

// Re-place a room's objects onto a clean clone to confirm every object lives in
// a zone that allows its category and within that zone's capacity.
function assertRoomValid(room: Room) {
  const zoneCounts = new Map<string, number>();
  for (const object of room.objects) {
    const asset = getAsset(object.assetId);
    expect(asset, `asset ${object.assetId} exists`).toBeTruthy();
    const zone = findZone(room, object.zoneId);
    expect(zone, `zone ${object.zoneId} exists`).toBeTruthy();
    // Category must be allowed in its zone.
    expect(zone!.allowedCategories).toContain(asset!.category);
    // Asset must be compatible with the zone it landed in.
    expect(asset!.compatibleZones ?? []).toContain(object.zoneId);
    const next = (zoneCounts.get(object.zoneId) ?? 0) + 1;
    zoneCounts.set(object.zoneId, next);
  }
  // No zone exceeds its capacity.
  Array.from(zoneCounts.entries()).forEach(([zoneId, count]) => {
    const zone = findZone(room, zoneId)!;
    if (zone.maxObjects !== undefined) expect(count).toBeLessThanOrEqual(zone.maxObjects);
  });
}

describe("tokenize", () => {
  it("lowercases and drops short tokens / punctuation", () => {
    expect(tokenize("Create a Cozy Reading-Room!")).toEqual(["create", "cozy", "reading", "room"]);
  });
});

describe("keyword matching", () => {
  it("maps a reading brief to the reading intent", () => {
    const match = matchIntent("Create a cozy reading room with lots of books");
    expect(match.intent.id).toBe("reading");
    expect(match.matchedKeywords).toContain("reading");
    expect(match.matchedKeywords).toContain("books");
  });

  it("maps a photography brief to the photography intent", () => {
    expect(matchIntent("A photography studio for my portfolio").intent.id).toBe("photography");
  });

  it("maps a gaming brief to the gaming intent", () => {
    expect(matchIntent("Build me a gaming room for streaming").intent.id).toBe("gaming");
  });

  it("maps a minimalist office brief to the office intent", () => {
    expect(matchIntent("a minimalist office workspace").intent.id).toBe("office");
  });

  it("falls back to the personal intent when nothing matches", () => {
    const match = matchIntent("xyzzy quux blorp");
    expect(match.intent.id).toBe("personal");
    expect(match.matchedKeywords).toEqual([]);
  });

  it("every non-fallback intent matches at least one of its own keywords", () => {
    for (const intent of DESIGN_INTENTS) {
      if (intent.id === "personal") continue;
      const match = matchIntent(intent.keywords[0]);
      expect(match.intent.id).toBe(intent.id);
    }
  });
});

describe("asset ranking", () => {
  it("ranks an intent's core assets above unrelated ones", () => {
    const reading = DESIGN_INTENTS.find((i) => i.id === "reading")!;
    const ranked = scoreAssets(reading, "cozy", 0);
    const ids = ranked.map((s) => s.asset.id);
    // Bookshelf is core to a reading room; it should beat a shop product shelf.
    expect(ids.indexOf("ast-bookshelf")).toBeLessThan(ids.indexOf("ast-product-shelf"));
  });

  it("never ranks navigation assets (doors/stairs)", () => {
    const ranked = scoreAssets(DESIGN_INTENTS[0], "cozy", 0);
    const ids = ranked.map((s) => s.asset.id);
    expect(ids).not.toContain("ast-door");
    expect(ids).not.toContain("ast-stairs");
  });

  it("is sorted by descending score", () => {
    const ranked = scoreAssets(DESIGN_INTENTS[0], "modern", 2);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });
});

describe("deterministic generation", () => {
  it("produces identical compositions for identical input", () => {
    const a = generateRoomDesign({ brief: "cozy reading room", address: ADDRESS, style: "cozy", variant: 0 });
    const b = generateRoomDesign({ brief: "cozy reading room", address: ADDRESS, style: "cozy", variant: 0 });
    expect(a.room.objects.map((o) => o.assetId)).toEqual(b.room.objects.map((o) => o.assetId));
    expect(a.room.type).toBe(b.room.type);
    expect(a.room.background).toBe(b.room.background);
    expect(a.explanations).toEqual(b.explanations);
  });

  it("varies the layout when the variant changes (regenerate)", () => {
    const studio = DESIGN_INTENTS.find((i) => i.id === "art_studio")!;
    const base = scoreAssets(studio, "creative", 0).map((s) => s.asset.id);
    // Across a few regenerations at least one ordering must differ (deterministic
    // jitter reshuffles near-ties), proving Regenerate yields fresh layouts.
    const differs = [1, 2, 3, 4].some(
      (v) => scoreAssets(studio, "creative", v).map((s) => s.asset.id).join() !== base.join(),
    );
    expect(differs).toBe(true);
  });

  it("applies an explicit room-type override", () => {
    const design = generateRoomDesign({ brief: "cozy reading room", address: ADDRESS, roomType: "office" });
    expect(design.room.type).toBe("office");
    expect(design.room.background).toBe("office");
  });
});

describe("room validity", () => {
  it("generates a valid room for every style", () => {
    for (const style of DESIGN_STYLES) {
      const design = generateRoomDesign({ brief: "a creative photography studio and shop", address: ADDRESS, style });
      expect(design.room.objects.length).toBeGreaterThan(0);
      assertRoomValid(design.room);
    }
  });

  it("placed objects pass validatePlacement against their own room", () => {
    const design = generateRoomDesign({ brief: "minimalist office", address: ADDRESS, style: "minimal" });
    for (const object of design.room.objects) {
      const asset = getAsset(object.assetId)!;
      // Validate ignoring the object itself (it already occupies a slot).
      expect(validatePlacement(design.room, asset.category, object.zoneId, object.id)).toBe(true);
    }
  });
});

describe("explanation generation", () => {
  it("explains the theme, background, style, and each object", () => {
    const design = generateRoomDesign({ brief: "Create a cozy reading room", address: ADDRESS, style: "cozy" });
    expect(design.explanations.length).toBeGreaterThanOrEqual(3 + design.picks.length);
    const joined = design.explanations.join(" ").toLowerCase();
    expect(joined).toContain("reading room");
    expect(joined).toContain("background");
    // Every placed object is named in an explanation line.
    for (const pick of design.picks) {
      expect(joined).toContain(pick.assetName.toLowerCase());
    }
  });

  it("notes when no theme was detected", () => {
    const design = generateRoomDesign({ brief: "zzzz qqqq", address: ADDRESS });
    expect(design.explanations[0].toLowerCase()).toContain("no strong theme");
  });
});

// ── V2: advanced brief parsing ──

describe("brief parsing — creator type", () => {
  const cases: [string, string][] = [
    ["I'm a photographer with a portfolio", "photographer"],
    ["a developer studio for my projects", "developer"],
    ["my podcast room", "podcaster"],
    ["a shop owner selling mugs", "shop_owner"],
    ["a writer's corner", "writer"],
    ["a musician's lounge", "musician"],
    ["a product designer studio", "designer"],
    ["a coach and consultant office", "coach"],
    ["a painter's gallery", "artist"],
  ];
  it.each(cases)("detects creator type in %j", (brief, expected) => {
    expect(parseBrief(brief).creatorType).toBe(expected);
  });
});

describe("brief parsing — mood", () => {
  it("detects moods", () => {
    expect(parseBrief("a dark moody room").mood).toBe("dark");
    expect(parseBrief("a cozy little space").mood).toBe("cozy");
    expect(parseBrief("a luxury suite").mood).toBe("luxury");
    expect(parseBrief("a minimalist clean room").mood).toBe("minimal");
    expect(parseBrief("a playful fun room").mood).toBe("playful");
  });
});

describe("brief parsing — purpose", () => {
  it("detects purpose", () => {
    expect(parseBrief("a room for taking bookings").purpose).toBe("booking");
    expect(parseBrief("a place for selling products").purpose).toBe("selling");
    expect(parseBrief("show my portfolio").purpose).toBe("portfolio");
    expect(parseBrief("a community guestbook space").purpose).toBe("community");
  });
});

describe("brief parsing — constraints", () => {
  it("detects exclusions", () => {
    expect(parseBrief("a room with no plants").constraints.noPlants).toBe(true);
    expect(parseBrief("no video please").constraints.noVideo).toBe(true);
    expect(parseBrief("no products, just links").constraints.noProducts).toBe(true);
  });
  it("detects a max object count", () => {
    expect(parseBrief("only 4 objects").constraints.maxObjects).toBe(4);
    expect(parseBrief("maximum 3 objects").constraints.maxObjects).toBe(3);
    expect(parseBrief("keep it to 2 objects").constraints.maxObjects).toBe(2);
  });
  it("detects minimal and show-X flags", () => {
    const c = parseBrief("a minimal room, show booking, show gallery, social links").constraints;
    expect(c.minimal).toBe(true);
    expect(c.showBooking).toBe(true);
    expect(c.showGallery).toBe(true);
    expect(c.showSocialLinks).toBe(true);
  });
});

describe("constraints engine (generation)", () => {
  it("excludes plant assets when told no plants", () => {
    const design = generateRoomDesign({ brief: "a cozy reading room with no plants", address: ADDRESS, style: "cozy" });
    const plants = design.room.objects.filter((o) => getAsset(o.assetId)?.category === "plant");
    expect(plants).toHaveLength(0);
  });
  it("excludes video objects when told no video", () => {
    const design = generateRoomDesign({ brief: "a gaming room with no video", address: ADDRESS, style: "modern" });
    expect(design.room.objects.every((o) => o.actionType !== "video")).toBe(true);
  });
  it("caps the object count with a max constraint", () => {
    const design = generateRoomDesign({ brief: "a creative studio with only 3 objects", address: ADDRESS, style: "creative" });
    expect(design.room.objects.length).toBeLessThanOrEqual(3);
  });
  it("uses fewer objects when minimal", () => {
    const minimal = generateRoomDesign({ brief: "a clean minimal studio", address: ADDRESS, style: "creative" });
    expect(minimal.room.objects.length).toBeLessThanOrEqual(4);
  });
  it("prioritises a product shelf when selling", () => {
    const design = generateRoomDesign({ brief: "an online shop selling products", address: ADDRESS, style: "modern" });
    expect(design.room.objects.some((o) => o.actionType === "product")).toBe(true);
  });
  it("includes a booking object when bookings are requested", () => {
    const design = generateRoomDesign({ brief: "a coaching room, show booking", address: ADDRESS, style: "professional" });
    expect(design.room.objects.some((o) => o.actionType === "booking")).toBe(true);
  });
  it("reports detected constraints for the explanation panel", () => {
    const design = generateRoomDesign({ brief: "a minimal room with no plants and only 4 objects", address: ADDRESS, style: "cozy" });
    expect(design.detectedConstraints).toContain("no plants");
    expect(design.detectedConstraints).toContain("minimal / clean");
    expect(design.detectedConstraints).toContain("max 4 objects");
  });
});

describe("describeConstraints", () => {
  it("returns empty for no constraints", () => {
    expect(describeConstraints({})).toEqual([]);
  });
});

describe("creator presets", () => {
  it("exposes eight presets, each with a brief and style", () => {
    expect(CREATOR_PRESETS).toHaveLength(8);
    for (const preset of CREATOR_PRESETS) {
      expect(preset.brief.length).toBeGreaterThan(0);
      expect(DESIGN_STYLES).toContain(preset.style);
    }
  });
  it("every preset generates a non-empty room deterministically", () => {
    for (const preset of CREATOR_PRESETS) {
      const a = generateRoomDesign({ brief: preset.brief, address: ADDRESS, style: preset.style });
      const b = generateRoomDesign({ brief: preset.brief, address: ADDRESS, style: preset.style });
      expect(a.room.objects.length).toBeGreaterThan(0);
      expect(a.room.objects.map((o) => o.assetId)).toEqual(b.room.objects.map((o) => o.assetId));
    }
  });
});

describe("V2 result shape", () => {
  it("returns the parsed brief and detected constraints", () => {
    const design = generateRoomDesign({ brief: "a dark minimalist developer room with no plants", address: ADDRESS });
    expect(design.parsed.creatorType).toBe("developer");
    expect(design.parsed.mood).toBe("dark");
    expect(design.parsed.constraints.noPlants).toBe(true);
    expect(design.detectedConstraints).toContain("no plants");
  });
  it("derives style from mood when none is passed", () => {
    // "dark" mood → modern style.
    expect(generateRoomDesign({ brief: "a dark developer room", address: ADDRESS }).style).toBe("modern");
  });
});
