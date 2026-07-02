import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NEST_SLOT_TYPES, isSurfaceAsset } from "@/lib/nest-types";
import type { NestAsset, NestSlotType, NestSurfaceKind } from "@/lib/nest-types";
import {
  LAPTOP_SCREEN_WEBSITE,
  PRODUCTION_PACK_INTERACTIONS,
  PRODUCTION_PACK_INTERACTIONS_BY_ID,
  PRODUCTION_PACK_SURFACE_ASSETS,
  PRODUCTION_PACK_SURFACE_ASSETS_BY_ID,
  SPEAKER_PULSE_MUSIC,
} from "@/lib/fixtures/production-pack-v1";

// The M9.1 alignment test: every Production Pack V1 metadata asset must map onto the
// LIVE contract in lib/nest-types.ts (categories, slot types, interactions, surfaces).

// Runtime mirrors of the closed contract unions (the test encodes the expected shape).
const NEST_ASSET_CATEGORIES = new Set([
  "furniture", "electronics", "lighting", "plant", "decor",
  "creator_tool", "business", "surface", "avatar", "personal",
]);
const NEST_SURFACE_KINDS = new Set<NestSurfaceKind>([
  "screen", "photo", "cover", "note-board", "surface-projection",
]);
const SLOT_TYPES = new Set<NestSlotType>(NEST_SLOT_TYPES);

type PackAsset = {
  id: string;
  name: string;
  category: string;
  surfaceKind?: string;
  compatibleSlotTypes?: string[];
  editableSurfaces?: { kind: string }[];
  interaction?: { defaultInteractionId?: string } | null;
};

const pack = JSON.parse(
  readFileSync(new URL("../metadata/production-pack-v1.json", import.meta.url), "utf8"),
) as {
  _meta: { counts: Record<string, unknown> };
  packs: Record<string, { backgrounds?: unknown[]; objects?: PackAsset[] }>;
};

const allObjects: PackAsset[] = Object.values(pack.packs).flatMap((p) => p.objects ?? []);
const allBackgrounds = Object.values(pack.packs).flatMap((p) => p.backgrounds ?? []);

describe("M9.1 — new interactions are live", () => {
  it("adds laptop_screen_website (screen_on → website)", () => {
    expect(PRODUCTION_PACK_INTERACTIONS_BY_ID["laptop_screen_website"]).toBe(LAPTOP_SCREEN_WEBSITE);
    expect(LAPTOP_SCREEN_WEBSITE.animation).toBe("screen_on");
    expect(LAPTOP_SCREEN_WEBSITE.contentType).toBe("website");
    expect(LAPTOP_SCREEN_WEBSITE.reducedMotionFallback).toBe("none");
  });

  it("adds speaker_pulse_music (pulse → music)", () => {
    expect(PRODUCTION_PACK_INTERACTIONS_BY_ID["speaker_pulse_music"]).toBe(SPEAKER_PULSE_MUSIC);
    expect(SPEAKER_PULSE_MUSIC.animation).toBe("pulse");
    expect(SPEAKER_PULSE_MUSIC.contentType).toBe("music");
  });

  it("keeps the Golden Nest five + the two additions (7 total), all with fallbacks", () => {
    expect(PRODUCTION_PACK_INTERACTIONS).toHaveLength(7);
    for (const i of PRODUCTION_PACK_INTERACTIONS) {
      expect(i.reducedMotionFallback).toBeTruthy();
    }
  });
});

describe("M9.1 — cover/photo skins are standalone surface assets (not variants)", () => {
  it("materializes 5 surface assets, each category 'surface' with a surfaceKind", () => {
    expect(PRODUCTION_PACK_SURFACE_ASSETS).toHaveLength(5);
    for (const a of PRODUCTION_PACK_SURFACE_ASSETS) {
      expect(a.category).toBe("surface");
      expect(isSurfaceAsset(a)).toBe(true);
      expect(a.surfaceKind && NEST_SURFACE_KINDS.has(a.surfaceKind)).toBe(true);
      // A surface skin is not slot-placed and carries no variants (it IS the skin).
      expect(a.compatibleSlotTypes).toEqual([]);
      expect(a.variants).toEqual([]);
    }
  });

  it("covers the 3 book covers + 2 photo cards", () => {
    const covers = PRODUCTION_PACK_SURFACE_ASSETS.filter((a) => a.surfaceKind === "cover");
    const photos = PRODUCTION_PACK_SURFACE_ASSETS.filter((a) => a.surfaceKind === "photo");
    expect(covers).toHaveLength(3);
    expect(photos).toHaveLength(2);
    expect(PRODUCTION_PACK_SURFACE_ASSETS_BY_ID["ast-fx-bookcover-a"].surfaceKind).toBe("cover");
    expect(PRODUCTION_PACK_SURFACE_ASSETS_BY_ID["ast-fx-photo-surface-portrait"].surfaceKind).toBe("photo");
  });
});

describe("M9.1 — every Production Pack V1 asset maps to the live contract", () => {
  it("has the expected corpus (65 assets = 4 bg + 42 objects + 19 focus)", () => {
    expect(allBackgrounds).toHaveLength(4);
    expect(allObjects).toHaveLength(42 + 19);
    expect(pack._meta.counts.totalAssets).toBe(65);
  });

  it("every object category is a live NestAssetCategory", () => {
    for (const a of allObjects) {
      expect(NEST_ASSET_CATEGORIES.has(a.category), `${a.id} category ${a.category}`).toBe(true);
    }
  });

  it("every compatibleSlotType is a live NestSlotType (incl. seat/table/rug/pinboard)", () => {
    const used = new Set<string>();
    for (const a of allObjects) {
      for (const s of a.compatibleSlotTypes ?? []) {
        used.add(s);
        expect(SLOT_TYPES.has(s as NestSlotType), `${a.id} slot ${s}`).toBe(true);
      }
    }
    // the 4 new slot types are actually exercised by the pack
    for (const s of ["seat", "table", "rug", "pinboard"]) {
      expect(used.has(s), `slot type ${s} unused`).toBe(true);
    }
  });

  it("every defaultInteractionId resolves in the live interaction library", () => {
    for (const a of allObjects) {
      const id = a.interaction?.defaultInteractionId;
      if (id) {
        expect(PRODUCTION_PACK_INTERACTIONS_BY_ID[id], `${a.id} interaction ${id}`).toBeTruthy();
      }
    }
  });

  it("every editableSurface kind is a live NestSurfaceKind", () => {
    for (const a of allObjects) {
      for (const s of a.editableSurfaces ?? []) {
        expect(NEST_SURFACE_KINDS.has(s.kind as NestSurfaceKind), `${a.id} surface ${s.kind}`).toBe(true);
      }
    }
  });

  it("every metadata surface asset has category 'surface' + a surfaceKind", () => {
    const surfaces = allObjects.filter((a) => a.category === "surface");
    expect(surfaces).toHaveLength(5);
    for (const a of surfaces) {
      expect(a.surfaceKind && NEST_SURFACE_KINDS.has(a.surfaceKind as NestSurfaceKind)).toBe(true);
      expect(a.compatibleSlotTypes).toEqual([]);
    }
  });
});

// Type-only guard: PRODUCTION_PACK_SURFACE_ASSETS is a real NestAsset[] (compile-time).
const _typecheck: NestAsset[] = PRODUCTION_PACK_SURFACE_ASSETS;
void _typecheck;
