import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { composeNest, NestCompositionError } from "@/lib/nest-composer";
import type { ComposeNestInput } from "@/lib/nest-composer-types";
import { validateComposedNest } from "@/lib/nest-types";
import type { NestAsset, NestTemplate } from "@/lib/nest-types";
import { CURRENT_NEST_DNA_VERSION, NEST_CAMERA_CONTRACT_VERSION } from "@/lib/nest-types";
import {
  GOLDEN_NEST_V2_ASSETS,
  GOLDEN_NEST_V2_ASSETS_BY_ID,
  GOLDEN_NEST_V2_INTERACTIONS,
  GOLDEN_NEST_V2_TEMPLATE,
} from "@/lib/fixtures/golden-nest-v2";
import { GOLDEN_NEST_V2_POLICY } from "@/lib/fixtures/golden-nest-v2-policy";
import {
  NEST_CREATOR_PROFILES,
  PROFILE_FOUNDER,
  PROFILE_MUSICIAN,
  PROFILE_PHOTOGRAPHER,
} from "@/lib/fixtures/nest-creator-profiles";
import type { CreatorNestProfile } from "@/lib/nest-composer-types";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Build a fresh Composer input around the locked Golden Nest V2 catalog. */
function input(profile: CreatorNestProfile, assets: NestAsset[] = GOLDEN_NEST_V2_ASSETS): ComposeNestInput {
  return {
    profile,
    templates: [GOLDEN_NEST_V2_TEMPLATE],
    assets,
    interactions: GOLDEN_NEST_V2_INTERACTIONS,
    policy: GOLDEN_NEST_V2_POLICY,
  };
}

const slotAsset = (result: ReturnType<typeof composeNest>, slotId: string): string | undefined =>
  result.nest.slotAssignments.find((a) => a.slotId === slotId)?.assetId;

const slotContent = (result: ReturnType<typeof composeNest>, slotId: string) =>
  result.nest.slotAssignments.find((a) => a.slotId === slotId)?.content;

// ── 1. Determinism ───────────────────────────────────────────────────────────
describe("determinism", () => {
  it("the same profile + catalog always produces the same result", () => {
    const a = composeNest(input(PROFILE_FOUNDER));
    const b = composeNest(input(PROFILE_FOUNDER));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("is stable across all three profiles", () => {
    for (const p of NEST_CREATOR_PROFILES) {
      expect(JSON.stringify(composeNest(input(p)))).toBe(JSON.stringify(composeNest(input(p))));
    }
  });
});

// ── 2 + 3 + 17. Valid manifests, required slots, validation ──────────────────
describe("valid manifests", () => {
  it("every fixture profile produces a valid ComposedNest that passes validateComposedNest", () => {
    for (const p of NEST_CREATOR_PROFILES) {
      const result = composeNest(input(p));
      const validation = validateComposedNest(result.nest, GOLDEN_NEST_V2_TEMPLATE, GOLDEN_NEST_V2_ASSETS_BY_ID);
      expect(validation.ok).toBe(true);
      expect(validation.errors).toEqual([]);
    }
  });

  it("fills every required slot for every profile", () => {
    for (const p of NEST_CREATOR_PROFILES) {
      const result = composeNest(input(p));
      for (const slotId of GOLDEN_NEST_V2_POLICY.requiredSlotIds) {
        expect(slotAsset(result, slotId)).toBeTruthy();
      }
    }
  });

  it("composes exactly the locked seven objects (cap respected)", () => {
    const result = composeNest(input(PROFILE_FOUNDER));
    expect(result.nest.slotAssignments).toHaveLength(7);
    expect(result.nest.slotAssignments.length).toBeLessThanOrEqual(GOLDEN_NEST_V2_POLICY.maxObjects);
  });
});

// ── 4. Excluded bookshelf slot stays empty ───────────────────────────────────
describe("excluded slot", () => {
  it("never fills the excluded bookshelf slot", () => {
    for (const p of NEST_CREATOR_PROFILES) {
      const result = composeNest(input(p));
      expect(slotAsset(result, "slot-bookshelf")).toBeUndefined();
      expect(result.nest.slotAssignments.some((a) => a.assetId === "ast-bookshelf")).toBe(false);
    }
  });
});

// ── 5. Only approved assets are selected ─────────────────────────────────────
describe("approval gate", () => {
  it("selects only approved assets", () => {
    for (const p of NEST_CREATOR_PROFILES) {
      const result = composeNest(input(p));
      for (const a of result.nest.slotAssignments) {
        expect(GOLDEN_NEST_V2_ASSETS_BY_ID[a.assetId].approvalStatus).toBe("approved");
      }
    }
  });

  it("rejects an unapproved asset (required slot then has no candidate)", () => {
    const assets = clone(GOLDEN_NEST_V2_ASSETS);
    assets.find((a) => a.id === "ast-tv")!.approvalStatus = "pending_review";
    expect(() => composeNest(input(PROFILE_FOUNDER, assets))).toThrow(NestCompositionError);
  });
});

// ── 6. Camera-contract mismatch rejected ─────────────────────────────────────
describe("camera contract", () => {
  it("rejects an asset whose camera contract does not match the template", () => {
    const assets = clone(GOLDEN_NEST_V2_ASSETS);
    assets.find((a) => a.id === "ast-tv")!.cameraContractVersion = "iso-30-v1";
    expect(() => composeNest(input(PROFILE_FOUNDER, assets))).toThrow(/slot-media/);
  });
});

// ── 7. DNA mismatch rejected ─────────────────────────────────────────────────
describe("dna version", () => {
  it("rejects an asset whose DNA version does not match the template", () => {
    const assets = clone(GOLDEN_NEST_V2_ASSETS);
    assets.find((a) => a.id === "ast-tv")!.dnaVersion = "nestudio-v1-legacy";
    expect(() => composeNest(input(PROFILE_FOUNDER, assets))).toThrow(NestCompositionError);
  });
});

// ── 8. Slot/category incompatibility rejected ────────────────────────────────
describe("slot compatibility", () => {
  it("rejects an asset whose category the slot does not accept", () => {
    const assets = clone(GOLDEN_NEST_V2_ASSETS);
    // ast-tv now declares the media slot type but is a 'plant' — slot-media only
    // accepts 'electronics', so it must be filtered out (leaving no candidate).
    assets.find((a) => a.id === "ast-tv")!.category = "plant";
    expect(() => composeNest(input(PROFILE_FOUNDER, assets))).toThrow(/slot-media/);
  });

  it("ignores an incompatible extra candidate and keeps the compatible one", () => {
    const assets = clone(GOLDEN_NEST_V2_ASSETS);
    assets.push({
      ...clone(GOLDEN_NEST_V2_ASSETS_BY_ID["ast-tv"]),
      id: "ast-bad-media",
      category: "plant", // not accepted by slot-media
    });
    const result = composeNest(input(PROFILE_FOUNDER, assets));
    expect(slotAsset(result, "slot-media")).toBe("ast-tv");
  });
});

// ── 9. Content sources are not unintentionally reused ────────────────────────
describe("content reuse", () => {
  it("binds each creator content source at most once", () => {
    for (const p of NEST_CREATOR_PROFILES) {
      const result = composeNest(input(p));
      const boundUrls = result.nest.slotAssignments
        .map((a) => a.content?.url)
        .filter((u): u is string => Boolean(u));
      expect(new Set(boundUrls).size).toBe(boundUrls.length);

      // No bound source also appears as a quick link.
      const quickUrls = new Set(result.nest.quickLinks.map((q) => q.url));
      for (const u of boundUrls) expect(quickUrls.has(u)).toBe(false);
    }
  });
});

// ── 10. Media prioritises YouTube / video ────────────────────────────────────
describe("media content priority", () => {
  it("binds YouTube to media when present (founder)", () => {
    const result = composeNest(input(PROFILE_FOUNDER));
    expect(slotContent(result, "slot-media")?.url).toBe("https://example.com/founder/youtube");
    expect(slotContent(result, "slot-media")?.contentType).toBe("video");
  });

  it("falls back to a plain video when there is no YouTube (musician)", () => {
    const result = composeNest(input(PROFILE_MUSICIAN));
    expect(slotContent(result, "slot-media")?.url).toBe("https://example.com/musician/video");
  });
});

// ── 11. Frame prioritises gallery ────────────────────────────────────────────
describe("frame content priority", () => {
  it("binds a gallery to the frame when present", () => {
    const founder = composeNest(input(PROFILE_FOUNDER));
    expect(slotContent(founder, "slot-frame")?.url).toBe("https://example.com/founder/gallery");
    expect(slotContent(founder, "slot-frame")?.contentType).toBe("gallery");
  });

  it("falls back to Instagram on the frame when there is no gallery (musician)", () => {
    const musician = composeNest(input(PROFILE_MUSICIAN));
    expect(slotContent(musician, "slot-frame")?.url).toBe("https://example.com/musician/instagram");
  });
});

// ── 12. Books prioritise articles ────────────────────────────────────────────
describe("books content priority", () => {
  it("binds an article to the books slot (founder, lowest-priority article wins)", () => {
    const result = composeNest(input(PROFILE_FOUNDER));
    expect(slotContent(result, "slot-books")?.url).toBe("https://example.com/founder/build");
    expect(slotContent(result, "slot-books")?.contentType).toBe("article");
  });

  it("binds no content to books when there is no article (musician)", () => {
    const result = composeNest(input(PROFILE_MUSICIAN));
    expect(slotContent(result, "slot-books")).toBeUndefined();
  });
});

// ── 13. Invalid ambience falls back with a warning ───────────────────────────
describe("ambience fallback", () => {
  it("uses the preferred ambience when valid", () => {
    const result = composeNest(input(PROFILE_FOUNDER));
    expect(result.nest.ambiencePresetId).toBe("golden_evening");
    expect(result.warnings).toEqual([]);
  });

  it("falls back with a warning when the preferred ambience is invalid", () => {
    const profile = clone(PROFILE_FOUNDER);
    profile.preferredAmbienceId = "midnight_disco"; // not on the template
    const result = composeNest(input(profile));
    expect(result.nest.ambiencePresetId).toBe(GOLDEN_NEST_V2_POLICY.fallbackAmbienceId);
    expect(result.warnings.some((w) => /midnight_disco/.test(w))).toBe(true);
  });
});

// ── 14. Remaining content becomes quick links ────────────────────────────────
describe("quick links", () => {
  it("turns unbound sources into quick links (musician: spotify + website)", () => {
    const result = composeNest(input(PROFILE_MUSICIAN));
    const urls = result.nest.quickLinks.map((q) => q.url);
    expect(urls).toContain("https://example.com/musician/spotify");
    expect(urls).toContain("https://example.com/musician");
  });

  it("orders quick links by priority then id (founder: website before 2nd article)", () => {
    const result = composeNest(input(PROFILE_FOUNDER));
    const urls = result.nest.quickLinks.map((q) => q.url);
    expect(urls).toEqual([
      "https://example.com/founder", // website, priority 2
      "https://example.com/founder/focus", // 2nd article, priority 4
    ]);
  });
});

// ── 15. Stable alphabetical tie-breaking ─────────────────────────────────────
describe("tie-breaking", () => {
  it("breaks an exact score tie on asset id (ascending)", () => {
    const tieTemplate: NestTemplate = {
      id: "t-tie",
      name: "Tie template",
      description: "",
      cameraContractVersion: NEST_CAMERA_CONTRACT_VERSION,
      dnaVersion: CURRENT_NEST_DNA_VERSION,
      backgroundImageUrl: "",
      aspectRatio: "3:4",
      sceneBox: {
        frontWall: { x: 0, y: 0, width: 1, height: 0.6 },
        leftSliver: { x: 0, y: 0, width: 0.1, height: 0.6 },
        rightSliver: { x: 0.9, y: 0, width: 0.1, height: 0.6 },
        floor: { x: 0, y: 0.6, width: 1, height: 0.4 },
        floorSeamY: 0.6,
        cameraTiltDeg: 7,
      },
      slots: [
        {
          id: "s1",
          name: "Media",
          slotType: "media",
          acceptedAssetCategories: ["electronics"],
          bounds: { x: 0.2, y: 0.2, width: 0.4, height: 0.3 },
          anchorPoint: { x: 0.4, y: 0.5 },
          zIndex: 1,
          plane: "front_wall",
          importance: "primary",
        },
      ],
      ambiencePresets: [{ id: "amb", name: "Amb", tint: "#fff", glow: "#fff", intensity: 0.2 }],
      defaultSlotAssignments: [],
      approvalStatus: "approved",
      createdAt: "2026-06-28T00:00:00.000Z",
      updatedAt: "2026-06-28T00:00:00.000Z",
    };
    const base = {
      name: "Screen",
      category: "electronics" as const,
      assetType: "standard" as const,
      compatibleSlotTypes: ["media" as const],
      tags: [],
      dnaVersion: CURRENT_NEST_DNA_VERSION,
      cameraContractVersion: NEST_CAMERA_CONTRACT_VERSION,
      imageUrl: "",
      thumbnailUrl: "",
      transparentPngUrl: "",
      variants: [],
      states: [{ name: "idle" as const }],
      approvalStatus: "approved" as const,
      source: "curated" as const,
      createdAt: "2026-06-28T00:00:00.000Z",
      updatedAt: "2026-06-28T00:00:00.000Z",
    };
    const assets: NestAsset[] = [
      { ...base, id: "ast-zzz" },
      { ...base, id: "ast-aaa" },
    ];
    const result = composeNest({
      profile: { id: "tie", displayName: "Tie", creatorTypes: [], personalityTags: [], interests: [], contentSources: [], accessLevel: "public" },
      templates: [tieTemplate],
      assets,
      interactions: [],
      policy: {
        templateId: "t-tie",
        maxObjects: 1,
        requiredSlotIds: ["s1"],
        optionalSlotIds: [],
        excludedSlotIds: [],
        contentRules: [],
        fallbackAssetBySlot: {},
        fallbackAmbienceId: "amb",
        allowAssetReuse: false,
      },
    });
    expect(result.nest.slotAssignments[0].assetId).toBe("ast-aaa");
  });
});

// ── 16. Missing required assets returns a clear error ────────────────────────
describe("missing required asset", () => {
  it("throws a clear NestCompositionError naming the slot", () => {
    const assets = GOLDEN_NEST_V2_ASSETS.filter((a) => a.id !== "ast-avatar");
    expect(() => composeNest(input(PROFILE_FOUNDER, assets))).toThrow(/slot-avatar/);
  });

  it("throws when the target template is absent from the catalog", () => {
    expect(() =>
      composeNest({
        profile: PROFILE_FOUNDER,
        templates: [],
        assets: GOLDEN_NEST_V2_ASSETS,
        interactions: GOLDEN_NEST_V2_INTERACTIONS,
        policy: GOLDEN_NEST_V2_POLICY,
      }),
    ).toThrow(NestCompositionError);
  });
});

// ── 18. No Math.random / external AI provider in the implementation ──────────
describe("purity (static scan)", () => {
  it("the composer source has no Math.random, network, or AI-provider calls", () => {
    const raw = readFileSync(fileURLToPath(new URL("../lib/nest-composer.ts", import.meta.url)), "utf8");
    // Strip block + line comments so the scan checks real code, not the doc comments
    // (which legitimately mention "Math.random" / "Date.now()" to document the rules).
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(/Math\.random\s*\(/.test(code)).toBe(false);
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
    expect(/\b(openai|gemini|anthropic|axios)\b/i.test(code)).toBe(false);
    expect(/Date\.now\s*\(/.test(code)).toBe(false);
  });
});

// ── Documented per-profile emphasis (sanity, ties everything together) ───────
describe("documented profile outcomes", () => {
  it("photographer: frame→gallery, media→youtube reel, avatar→bio, others as quick links", () => {
    const result = composeNest(input(PROFILE_PHOTOGRAPHER));
    expect(slotContent(result, "slot-frame")?.url).toBe("https://example.com/photographer/gallery");
    expect(slotContent(result, "slot-media")?.url).toBe("https://example.com/photographer/reel");
    expect(slotContent(result, "slot-avatar")?.contentType).toBe("intro");
    const quick = result.nest.quickLinks.map((q) => q.url);
    expect(quick).toContain("https://example.com/photographer/instagram");
    expect(quick).toContain("https://example.com/photographer");
  });
});
