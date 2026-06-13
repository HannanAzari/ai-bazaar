import { describe, it, expect } from "vitest";
import {
  ROOM_BOUND_MARGIN,
  ZONE_TEMPLATE,
  addObjectFromAsset,
  createRoom,
  deriveDefaultRoom,
  isRoomActionType,
  moveObjectTo,
  objectCenter,
  resizeObject,
  validatePlacement,
} from "@/lib/room-schema";
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from "@/lib/room-history";
import { ROOM_TEMPLATES, applyTemplate } from "@/lib/room-templates";
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

describe("move validation (free drag bounds)", () => {
  it("clamps an object's centre inside the room when dragged out of bounds", () => {
    let room = addObjectFromAsset(createRoom("x"), sofa);
    const id = room.objects[0].id;

    room = moveObjectTo(room, id, 5, 5); // far past the bottom-right
    let centre = objectCenter(room, room.objects[0]);
    expect(centre.x).toBeLessThanOrEqual(1 - ROOM_BOUND_MARGIN + 1e-9);
    expect(centre.y).toBeLessThanOrEqual(1 - ROOM_BOUND_MARGIN + 1e-9);

    room = moveObjectTo(room, id, -5, -5); // far past the top-left
    centre = objectCenter(room, room.objects[0]);
    expect(centre.x).toBeGreaterThanOrEqual(ROOM_BOUND_MARGIN - 1e-9);
    expect(centre.y).toBeGreaterThanOrEqual(ROOM_BOUND_MARGIN - 1e-9);
  });
  it("keeps an in-bounds centre exactly where requested", () => {
    let room = addObjectFromAsset(createRoom("x"), sofa);
    room = moveObjectTo(room, room.objects[0].id, 0.5, 0.5);
    const centre = objectCenter(room, room.objects[0]);
    expect(centre.x).toBeCloseTo(0.5);
    expect(centre.y).toBeCloseTo(0.5);
  });
  it("is a no-op for an unknown object", () => {
    const room = addObjectFromAsset(createRoom("x"), sofa);
    expect(moveObjectTo(room, "missing", 0.5, 0.5)).toBe(room);
  });
});

describe("resize validation", () => {
  it("applies positive width/height/scale", () => {
    let room = addObjectFromAsset(createRoom("x"), sofa);
    const id = room.objects[0].id;
    room = resizeObject(room, id, { width: 100, height: 80, scale: 1.4 });
    const obj = room.objects[0];
    expect(obj.width).toBe(100);
    expect(obj.height).toBe(80);
    expect(obj.scale).toBe(1.4);
  });
  it("rejects zero or negative dimensions (no-op, room stays valid)", () => {
    let room = addObjectFromAsset(createRoom("x"), sofa);
    const id = room.objects[0].id;
    room = resizeObject(room, id, { width: 100, height: 80, scale: 1.4 });
    expect(resizeObject(room, id, { width: 0 }).objects[0].width).toBe(100);
    expect(resizeObject(room, id, { height: -5 }).objects[0].height).toBe(80);
    expect(resizeObject(room, id, { scale: 0 }).objects[0].scale).toBe(1.4);
  });
});

describe("undo / redo history", () => {
  it("walks back and forward through states", () => {
    let history = createHistory(0);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);

    history = pushHistory(history, 1);
    history = pushHistory(history, 2);
    expect(history.present).toBe(2);

    history = undo(history);
    expect(history.present).toBe(1);
    history = undo(history);
    expect(history.present).toBe(0);
    expect(canUndo(history)).toBe(false);

    history = redo(history);
    expect(history.present).toBe(1);
    expect(canRedo(history)).toBe(true);
  });
  it("clears the redo stack when a new edit is made", () => {
    let history = createHistory("a");
    history = pushHistory(history, "b");
    history = undo(history); // present "a", future ["b"]
    expect(canRedo(history)).toBe(true);
    history = pushHistory(history, "c"); // fresh edit invalidates redo
    expect(canRedo(history)).toBe(false);
    expect(history.present).toBe("c");
  });
});

describe("template generation", () => {
  it("every template produces a valid, furnished room", () => {
    for (const template of ROOM_TEMPLATES) {
      const room = applyTemplate(template.id, "moon.blue.hour");
      expect(room.shopAddress).toBe("moon.blue.hour");
      expect(room.objects.length).toBeGreaterThan(0);

      // Each object respects category–zone and asset–zone compatibility.
      for (const object of room.objects) {
        const asset = getAsset(object.assetId)!;
        const zone = room.zones.find((z) => z.id === object.zoneId)!;
        expect(zone.allowedCategories).toContain(asset.category);
        expect(asset.compatibleZones).toContain(object.zoneId as never);
      }

      // No zone exceeds its capacity.
      for (const zone of room.zones) {
        if (zone.maxObjects === undefined) continue;
        const count = room.objects.filter((o) => o.zoneId === zone.id).length;
        expect(count).toBeLessThanOrEqual(zone.maxObjects);
      }
    }
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
