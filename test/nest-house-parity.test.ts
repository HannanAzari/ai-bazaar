import { describe, expect, it } from "vitest";
import {
  deriveHouse,
  houseFeatures,
  houseStyleOptions,
  houseStyleSeed,
  HOUSE_STYLE_KEYS,
  styleByKey,
} from "@/lib/nest-house";

// ── M24 §3 — the house you pick is the house you get ─────────────────────────
//
// The founder reported that the house chosen in onboarding did not match the house on
// their Profile — "only the colours roughly match". Both surfaces already rendered the
// same component with the same palette; what differed was the SEED, and `houseFeatures()`
// decodes the entire building (roof, windows, door, garden, chimney, fence, porch) from it.

/** What the onboarding carousel renders for a style. */
const onboardingSeed = (key: string) => houseStyleSeed(key);

/** What a creator's Profile / House / Village renders for that same chosen style. */
const profileSeed = (key: string, creatorId: string) =>
  deriveHouse({ creator: { id: creatorId, username: `user-${creatorId}` }, houseStyle: key }).seed;

describe("onboarding and Profile render the identical house", () => {
  it.each([...HOUSE_STYLE_KEYS])("%s is the same building in both places", (key) => {
    expect(profileSeed(key, "creator-a")).toBe(onboardingSeed(key));
    expect(houseFeatures(profileSeed(key, "creator-a"))).toEqual(houseFeatures(onboardingSeed(key)));
  });

  it("is identical for two different creators who picked the same style", () => {
    // A style is a promise about what you are choosing — it cannot vary per account.
    for (const key of HOUSE_STYLE_KEYS) {
      expect(profileSeed(key, "creator-a")).toBe(profileSeed(key, "creator-b"));
    }
  });

  it("matches on the architecture, not just the palette — the actual complaint", () => {
    for (const key of HOUSE_STYLE_KEYS) {
      const a = houseFeatures(onboardingSeed(key));
      const b = houseFeatures(profileSeed(key, "creator-z"));
      expect(a.roof).toBe(b.roof);
      expect(a.door).toBe(b.door);
      expect(a.windowShape).toBe(b.windowShape);
      expect(a.windowCount).toBe(b.windowCount);
      expect(a.fence).toBe(b.fence);
      expect(a.porch).toBe(b.porch);
      expect(a.chimney).toBe(b.chimney);
      expect(a.garden).toBe(b.garden);
    }
  });

  it("carries the palette across too", () => {
    for (const { key, style } of houseStyleOptions()) {
      const house = deriveHouse({ creator: { id: "creator-a" }, houseStyle: key });
      expect(house.style).toEqual(style);
      expect(house.style).toEqual(styleByKey(key));
    }
  });

  it("named styles from the brief specifically match", () => {
    for (const key of ["garden", "gamer"]) {
      expect(profileSeed(key, "founder")).toBe(onboardingSeed(key));
      expect(styleByKey(key).label).toBe(key === "garden" ? "Garden Cottage" : "Gamer Hollow");
    }
  });
});

describe("creators without a chosen style still vary", () => {
  it("keeps per-creator variety so the Village isn't a row of clones", () => {
    const a = deriveHouse({ creator: { id: "a", username: "ada" } }).seed;
    const b = deriveHouse({ creator: { id: "b", username: "bea" } }).seed;
    expect(a).not.toBe(b);
  });

  it("ignores an unknown stored style rather than rendering nothing", () => {
    const house = deriveHouse({ creator: { id: "a", username: "ada" }, houseStyle: "mansion" });
    expect(house.style).toBeDefined();
    expect(house.seed).toBe(deriveHouse({ creator: { id: "a", username: "ada" } }).seed);
  });
});
