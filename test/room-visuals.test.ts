import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_BACKGROUND_ID,
  ROOM_BACKGROUNDS,
  ROOM_BACKGROUND_IDS,
  defaultBackgroundForType,
  objectVisual,
  roomBackground,
} from "@/lib/room-visuals";
import { deriveDefaultHouse, withRoom } from "@/lib/house";
import { addObjectFromAsset } from "@/lib/room-schema";
import { getAsset } from "@/lib/assets";
import { getStoredHouse, saveHouse } from "@/lib/room";
import { shops } from "@/lib/data";

describe("visual variant selection", () => {
  it("maps known assets to their visual kind", () => {
    expect(objectVisual("ast-painting")).toBe("frame");
    expect(objectVisual("ast-photo-wall")).toBe("frame");
    expect(objectVisual("ast-screen")).toBe("screen");
    expect(objectVisual("ast-projector")).toBe("screen");
    expect(objectVisual("ast-product-shelf")).toBe("shelf");
    expect(objectVisual("ast-desk")).toBe("desk");
    expect(objectVisual("ast-avatar-portrait")).toBe("portrait");
    expect(objectVisual("ast-certificate")).toBe("certificate");
    expect(objectVisual("ast-achievement-board")).toBe("board");
    expect(objectVisual("ast-door")).toBe("door");
    expect(objectVisual("ast-stairs")).toBe("stairs");
  });
  it("falls back to category, then a generic tile", () => {
    expect(objectVisual("unknown", "plant")).toBe("plant");
    expect(objectVisual("unknown", "furniture")).toBe("seat");
    expect(objectVisual("unknown", "lighting")).toBe("tile");
    expect(objectVisual("unknown")).toBe("tile");
  });
  it("gives every real room-ready asset a specific (non-tile) treatment", () => {
    const ids = ["ast-bookshelf", "ast-rug", "ast-plant", "ast-sofa", "ast-sign", "ast-business-card", "ast-display-table", "ast-guestbook-table"];
    for (const id of ids) expect(objectVisual(id, getAsset(id)?.category)).not.toBe("tile");
  });
});

describe("background style validation", () => {
  it("exposes the five variants (incl. the warm default)", () => {
    expect(ROOM_BACKGROUND_IDS).toEqual(expect.arrayContaining(["standard", "gallery", "shop", "office", "garden"]));
    expect(ROOM_BACKGROUND_IDS).toHaveLength(5);
  });
  it("resolves known ids and falls back for unknown/empty", () => {
    expect(roomBackground("gallery").id).toBe("gallery");
    expect(roomBackground("nope").id).toBe(DEFAULT_BACKGROUND_ID);
    expect(roomBackground(undefined).id).toBe(DEFAULT_BACKGROUND_ID);
    for (const id of ROOM_BACKGROUND_IDS) {
      expect(ROOM_BACKGROUNDS[id].wall).toMatch(/^#[0-9a-f]{3,8}$/i);
      expect(typeof ROOM_BACKGROUNDS[id].tint).toBe("string");
    }
  });
  it("defaults a background by room type", () => {
    expect(defaultBackgroundForType("gallery")).toBe("gallery");
    expect(defaultBackgroundForType("shop")).toBe("shop");
    expect(defaultBackgroundForType("office")).toBe("office");
    expect(defaultBackgroundForType("garden")).toBe("garden");
    expect(defaultBackgroundForType("studio")).toBe(DEFAULT_BACKGROUND_ID);
    expect(defaultBackgroundForType("custom")).toBe(DEFAULT_BACKGROUND_ID);
  });
});

describe("rotation persistence", () => {
  beforeEach(() => localStorage.clear());
  it("persists an object's rotation and a room's background through the store", () => {
    const shop = shops[0];
    let house = deriveDefaultHouse(shop);
    let room = addObjectFromAsset(house.rooms[0], getAsset("ast-painting")!, "Tilted art");
    const objId = room.objects[room.objects.length - 1].id;
    room = {
      ...room,
      background: "gallery",
      objects: room.objects.map((o) => (o.id === objId ? { ...o, rotation: 42 } : o)),
    };
    house = withRoom(house, room);
    saveHouse(house);

    const loaded = getStoredHouse(shop.address)!;
    const reloaded = loaded.rooms[0];
    expect(reloaded.background).toBe("gallery");
    expect(reloaded.objects.find((o) => o.id === objId)?.rotation).toBe(42);
  });
});
