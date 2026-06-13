import { describe, it, expect, beforeEach } from "vitest";
import {
  addRoom,
  canDeleteRoom,
  createNamedRoom,
  deleteRoom,
  deriveDefaultHouse,
  isValidRoomLink,
  renameRoom,
  roomLinkTargets,
  setEntryRoom,
  updateRoomMeta,
  withRoom,
} from "@/lib/house";
import { getHouse, getStoredHouse, saveHouse } from "@/lib/room";
import { addObjectFromAsset, createRoom } from "@/lib/room-schema";
import { ROOM_PRESETS, buildPresetRoom } from "@/lib/room-templates";
import { getAsset } from "@/lib/assets";
import { eventCounts, trackEvent } from "@/lib/events";
import { shops } from "@/lib/data";

const shop = shops[0];
const door = getAsset("ast-door")!; // category "door", action room_link

describe("room creation", () => {
  it("adds a uniquely-identified room to the house", () => {
    let house = deriveDefaultHouse(shop);
    expect(house.rooms).toHaveLength(1);
    const room = createNamedRoom(shop.address, "Gallery", "gallery");
    house = addRoom(house, room);
    expect(house.rooms).toHaveLength(2);
    expect(house.rooms[1]).toMatchObject({ name: "Gallery", type: "gallery" });
  });
  it("regenerates a colliding room id (no duplicate ids)", () => {
    let house = deriveDefaultHouse(shop);
    house = addRoom(house, { ...house.rooms[0] }); // same id as the entry room
    const ids = house.rooms.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("builds a furnished preset room with a room type", () => {
    for (const preset of ROOM_PRESETS) {
      const room = buildPresetRoom(preset.id, shop.address);
      expect(room.objects.length).toBeGreaterThan(0);
      expect(room.type).toBe(preset.type);
    }
  });
});

describe("room deletion", () => {
  it("won't delete the last room", () => {
    const house = deriveDefaultHouse(shop);
    expect(canDeleteRoom(house, house.rooms[0].id).ok).toBe(false);
    expect(deleteRoom(house, house.rooms[0].id)).toBe(house); // no-op
  });
  it("won't delete a room that still has objects", () => {
    let house = deriveDefaultHouse(shop);
    const empty = createNamedRoom(shop.address, "Empty");
    house = addRoom(house, empty);
    expect(canDeleteRoom(house, house.entryRoomId).ok).toBe(false); // entry is furnished
    expect(canDeleteRoom(house, empty.id).ok).toBe(true);
    house = deleteRoom(house, empty.id);
    expect(house.rooms.some((r) => r.id === empty.id)).toBe(false);
  });
  it("reassigns entry and clears dangling door links on delete", () => {
    let house = deriveDefaultHouse(shop);
    const target = createNamedRoom(shop.address, "Target"); // empty
    house = addRoom(house, target);
    // a door in the entry room points at the (empty) target room
    let entry = house.rooms.find((r) => r.id === house.entryRoomId)!;
    entry = addObjectFromAsset(entry, door, "Door", { type: "room_link", data: { targetRoomId: target.id } });
    house = withRoom(house, entry);
    house = setEntryRoom(house, target.id); // target is empty, so it's deletable
    house = deleteRoom(house, target.id);
    expect(house.entryRoomId).not.toBe(target.id);
    const doorObj = house.rooms.flatMap((r) => r.objects).find((o) => o.actionType === "room_link");
    expect(doorObj?.actionData?.targetRoomId).toBeUndefined();
  });
});

describe("entry room validation", () => {
  it("only accepts an existing room as the entry", () => {
    const house = deriveDefaultHouse(shop);
    expect(setEntryRoom(house, "nope")).toBe(house);
    const room = createNamedRoom(shop.address, "R");
    expect(setEntryRoom(addRoom(house, room), room.id).entryRoomId).toBe(room.id);
  });
});

describe("door navigation", () => {
  it("validates a door target against the house rooms", () => {
    let house = deriveDefaultHouse(shop);
    const room = createNamedRoom(shop.address, "R");
    house = addRoom(house, room);
    expect(isValidRoomLink(house, room.id)).toBe(true);
    expect(isValidRoomLink(house, "ghost")).toBe(false);
    expect(isValidRoomLink(house, undefined)).toBe(false);
  });
  it("lists link targets excluding the current room", () => {
    let house = deriveDefaultHouse(shop);
    const room = createNamedRoom(shop.address, "R");
    house = addRoom(house, room);
    const targets = roomLinkTargets(house, house.entryRoomId).map((t) => t.id);
    expect(targets).toContain(room.id);
    expect(targets).not.toContain(house.entryRoomId);
  });
});

describe("room rename / meta", () => {
  it("trims renames, ignores empty, and updates type/description", () => {
    let house = deriveDefaultHouse(shop);
    const id = house.entryRoomId;
    house = renameRoom(house, id, "  Lounge  ");
    expect(house.rooms[0].name).toBe("Lounge");
    house = renameRoom(house, id, "   "); // empty → no-op
    expect(house.rooms[0].name).toBe("Lounge");
    house = updateRoomMeta(house, id, { type: "living_room", description: "cozy" });
    expect(house.rooms[0]).toMatchObject({ type: "living_room", description: "cozy" });
  });
});

describe("room persistence", () => {
  beforeEach(() => localStorage.clear());
  it("saves and reloads a multi-room house", () => {
    let house = deriveDefaultHouse(shop);
    house = addRoom(house, createNamedRoom(shop.address, "Studio", "studio"));
    saveHouse(house);
    const loaded = getStoredHouse(shop.address);
    expect(loaded?.rooms).toHaveLength(2);
    expect(loaded?.entryRoomId).toBe(house.entryRoomId);
  });
  it("migrates a legacy single-room save into a one-room house", () => {
    const legacy = createRoom(shop.address, "Old room");
    localStorage.setItem("ai-bazaar-rooms", JSON.stringify({ [shop.address]: legacy }));
    const house = getStoredHouse(shop.address);
    expect(house?.rooms).toHaveLength(1);
    expect(house?.entryRoomId).toBe(legacy.id);
    expect(house?.rooms[0].name).toBe("Old room");
  });
  it("falls back to a derived house for an unsaved shop", () => {
    expect(getHouse(shop).rooms.length).toBeGreaterThanOrEqual(1);
  });
});

describe("analytics events", () => {
  beforeEach(() => localStorage.clear());
  it("records multi-room navigation events", () => {
    trackEvent("room_entered", { shopId: "s1" });
    trackEvent("room_created", { shopId: "s1" });
    trackEvent("room_deleted", { shopId: "s1" });
    trackEvent("room_link_clicked", { shopId: "s1", targetId: "door1" });
    const counts = eventCounts();
    expect(counts.room_entered).toBe(1);
    expect(counts.room_created).toBe(1);
    expect(counts.room_deleted).toBe(1);
    expect(counts.room_link_clicked).toBe(1);
  });
});
