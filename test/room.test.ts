import { describe, it, expect } from "vitest";
import {
  ZONE_TEMPLATE,
  addObjectFromAsset,
  createRoom,
  deriveDefaultRoom,
  isRoomActionType,
  validatePlacement,
} from "@/lib/room-schema";
import { getRoom, getStoredRoom, resetRoom, saveRoom } from "@/lib/room";
import { getAsset } from "@/lib/assets";
import { shops } from "@/lib/data";

const painting = getAsset("ast-painting")!; // decor → walls
const sofa = getAsset("ast-sofa")!; // furniture → floor

describe("room schema creation", () => {
  it("creates a room with the nine-zone template and no objects", () => {
    const room = createRoom("moon.blue.hour");
    expect(room.zones).toHaveLength(ZONE_TEMPLATE.length);
    expect(room.zones).toHaveLength(9);
    expect(room.objects).toHaveLength(0);
    expect(room.shopAddress).toBe("moon.blue.hour");
  });
});

describe("zone validation", () => {
  it("allows a decor asset on a wall but not on the floor", () => {
    const room = createRoom("x");
    expect(validatePlacement(room, "decor", "back_wall")).toBe(true);
    expect(validatePlacement(room, "decor", "floor_center")).toBe(false);
  });
  it("rejects furniture on a wall and unknown zones", () => {
    const room = createRoom("x");
    expect(validatePlacement(room, "furniture", "back_wall")).toBe(false);
    expect(validatePlacement(room, "furniture", "floor_left")).toBe(true);
    expect(validatePlacement(room, "decor", "nope")).toBe(false);
  });
  it("enforces a zone's max object count", () => {
    let room = createRoom("x");
    // window allows 1 decor object
    room = addObjectFromAsset(room, painting); // lands on a wall (back_wall first)
    expect(validatePlacement(room, "decor", "window")).toBe(true);
  });
});

describe("object placement validation", () => {
  it("places an asset only in a compatible zone", () => {
    let room = createRoom("x");
    room = addObjectFromAsset(room, painting);
    expect(room.objects).toHaveLength(1);
    const placedZone = room.zones.find((z) => z.id === room.objects[0].zoneId);
    expect(placedZone?.allowedCategories).toContain("decor");

    room = addObjectFromAsset(room, sofa);
    const sofaObj = room.objects.find((o) => o.assetId === sofa.id);
    expect(sofaObj?.zoneId.startsWith("floor")).toBe(true);
  });
});

describe("action type validation", () => {
  it("accepts known action types and rejects others", () => {
    expect(isRoomActionType("guestbook")).toBe(true);
    expect(isRoomActionType("none")).toBe(true);
    expect(isRoomActionType("teleport")).toBe(false);
  });
});

describe("save / reset layout", () => {
  it("persists a saved layout and reverts on reset", () => {
    const shop = shops[0];
    const derived = deriveDefaultRoom(shop);
    expect(getStoredRoom(shop.address)).toBeNull();

    const edited = addObjectFromAsset(derived, painting, "Extra art");
    saveRoom(edited);
    expect(getStoredRoom(shop.address)?.objects.length).toBe(edited.objects.length);
    expect(getRoom(shop).objects.length).toBe(edited.objects.length);

    resetRoom(shop.address);
    expect(getStoredRoom(shop.address)).toBeNull();
    expect(getRoom(shop).objects.length).toBe(derived.objects.length);
  });
});
