import { describe, expect, it } from "vitest";
import { catalogAssets, getAsset, roomReadyAssets } from "@/lib/assets";
import { interiorV1Assets, INTERIOR_V1_IDS } from "@/lib/asset-catalogs";
import { renderableAssetImage } from "@/lib/room-visuals";
import { createRoom, validatePlacement } from "@/lib/room-schema";
import { buildInteriorV1TestRoom, pickInteriorAssets } from "@/lib/asset-catalogs/interior-v1-room";
import { DEFAULT_ROOM_SHELL_ID, furnishRoomShell, getRoomShell } from "@/lib/templates/room-shells";

const emptyRoom = createRoom("test.room.placement");
const picks = pickInteriorAssets();

describe("Interior V1 catalog merge (real Style Lab assets)", () => {
  it("merges the approved Style Lab assets into the main catalog", () => {
    expect(interiorV1Assets.length).toBeGreaterThanOrEqual(20);
    for (const asset of interiorV1Assets) {
      expect(catalogAssets.find((a) => a.id === asset.id)).toBeTruthy();
    }
  });

  it("ships real public image URLs (no placeholders / samples)", () => {
    for (const asset of interiorV1Assets) {
      expect(asset.imageUrl).toMatch(/^https:\/\/.*\/storage\/v1\/object\/public\//);
      expect(renderableAssetImage(asset.imageUrl)).toBe(asset.imageUrl);
    }
  });

  it("keeps the original hardcoded assets working (no regression)", () => {
    for (const id of ["ast-sofa", "ast-bookshelf", "ast-painting", "ast-001"]) {
      const asset = getAsset(id);
      expect(asset).toBeTruthy();
      expect(renderableAssetImage(asset!.imageUrl)).toBeUndefined(); // still placeholder → sprite
    }
  });

  it("uses unique ids (no collision with the originals)", () => {
    const ids = catalogAssets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(INTERIOR_V1_IDS.length).toBe(interiorV1Assets.length);
  });

  it("resolves the hero pieces (sofa / chair / table / desk) via getAsset", () => {
    expect(picks.sofa).toBeTruthy();
    expect(picks.chairLeft).toBeTruthy();
    expect(picks.table).toBeTruthy();
    for (const asset of [picks.sofa, picks.chairLeft, picks.table, picks.desk]) {
      if (!asset) continue;
      const found = getAsset(asset.id);
      expect(found).toBeTruthy();
      expect(found!.compatibleZones?.length).toBeGreaterThan(0);
      expect(renderableAssetImage(found!.imageUrl)).toBe(found!.imageUrl);
    }
  });

  it("roomReadyAssets includes the imported assets, all placeable in their zones", () => {
    const ready = roomReadyAssets();
    for (const asset of interiorV1Assets) {
      expect(ready.find((a) => a.id === asset.id)).toBeTruthy();
      for (const zone of asset.compatibleZones ?? []) {
        expect(validatePlacement(emptyRoom, asset.category, zone)).toBe(true);
      }
    }
    expect(ready.find((a) => a.id === "ast-bookshelf")).toBeTruthy(); // originals still ready
  });
});

describe("renderableAssetImage (image-first decision)", () => {
  it("returns real Style Lab / Supabase image URLs", () => {
    const supa = "https://x.supabase.co/storage/v1/object/public/asset-candidates/interior-v1/x.png";
    expect(renderableAssetImage(supa)).toBe(supa);
  });

  it("falls back (undefined) for placeholders, samples, and empties", () => {
    expect(renderableAssetImage("/assets/placeholder/sofa.svg")).toBeUndefined();
    expect(renderableAssetImage("/samples/abstract-canvas.png")).toBeUndefined();
    expect(renderableAssetImage("")).toBeUndefined();
    expect(renderableAssetImage("   ")).toBeUndefined();
    expect(renderableAssetImage(undefined)).toBeUndefined();
  });
});

describe("Interior V1 test room (engine placement)", () => {
  const room = buildInteriorV1TestRoom();

  it("is named and furnished from real assets", () => {
    expect(room.name).toBe("Nestudio Interior V1 Test Room");
    expect(room.objects.length).toBeGreaterThanOrEqual(3);
  });

  it("places every object in a zone its asset allows, with real art", () => {
    for (const object of room.objects) {
      const asset = getAsset(object.assetId)!;
      expect(asset.compatibleZones).toContain(object.zoneId);
      expect(validatePlacement(emptyRoom, asset.category, object.zoneId)).toBe(true);
      expect(renderableAssetImage(asset.imageUrl)).toBe(asset.imageUrl);
    }
  });

  it("is deterministic (stable ids + identical across builds)", () => {
    expect(room.objects.map((o) => o.id)).toEqual(room.objects.map((o, i) => `obj-int-${i + 1}-${o.assetId}`));
    const again = buildInteriorV1TestRoom();
    const shape = (r: typeof room) => r.objects.map(({ id, assetId, zoneId, x, y, scale, zIndex }) => ({ id, assetId, zoneId, x, y, scale, zIndex }));
    expect(shape(again)).toEqual(shape(room));
  });

  it("renders the real furniture at a readable scale", () => {
    for (const object of room.objects) expect(object.scale).toBeGreaterThanOrEqual(1.5);
  });
});

describe("Layered room shell template", () => {
  const shell = getRoomShell(DEFAULT_ROOM_SHELL_ID);

  it("loads the default shell template with a background image + calibration", () => {
    expect(shell).toBeTruthy();
    expect(shell!.imageUrl).toMatch(/\.(svg|png|webp|jpg)$/);
    expect(shell!.width).toBeGreaterThan(0);
    expect(shell!.height).toBeGreaterThan(0);
    expect(shell!.placementZones.length).toBeGreaterThanOrEqual(4);
    for (const r of [shell!.floorBounds, shell!.wallBounds, shell!.safeArea]) {
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    }
  });

  it("returns undefined for an unknown shell id", () => {
    expect(getRoomShell("does-not-exist")).toBeUndefined();
  });

  it("furnishes the shell with real Style Lab assets placed above the shell", () => {
    const pieces = furnishRoomShell(shell!);
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    const labels = pieces.map((p) => p.label);
    expect(labels).toContain("Sofa");
    expect(labels).toContain("Coffee Table");
    for (const piece of pieces) {
      // every placed piece renders a real image (image-first), layered (z) on top
      expect(renderableAssetImage(piece.asset.imageUrl)).toBe(piece.asset.imageUrl);
      expect(piece.z).toBeGreaterThan(0);
    }
    expect(new Set(pieces.map((p) => p.z)).size).toBe(pieces.length); // distinct layering
  });

  it("places furniture using the template's calibrated coordinates (not invented)", () => {
    const pieces = furnishRoomShell(shell!);
    for (const piece of pieces) {
      const zone = shell!.placementZones.find((z) => z.label === piece.label);
      expect(zone).toBeTruthy();
      expect(piece.cx).toBe(zone!.cx);
      expect(piece.baseY).toBe(zone!.baseY);
      expect(piece.width).toBe(zone!.width);
      // coordinates stay within the shell
      expect(piece.cx).toBeGreaterThanOrEqual(0);
      expect(piece.cx).toBeLessThanOrEqual(1);
      expect(piece.baseY).toBeGreaterThanOrEqual(0);
      expect(piece.baseY).toBeLessThanOrEqual(1);
    }
  });
});
