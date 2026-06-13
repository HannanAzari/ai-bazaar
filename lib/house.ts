import type { HouseRooms, Room, RoomKind, Shop } from "@/lib/types";
import { createRoom, deriveDefaultRoom, nextRoomId } from "@/lib/room-schema";

// Pure helpers for a house's set of connected rooms (V4). Like the room-level
// helpers, every function returns a NEW HouseRooms (no mutation) and an invalid
// operation is a no-op that leaves the house valid — so the engine never
// persists a house with a dangling entry room, a duplicate room id, or a door
// pointing at a room that doesn't exist.

export const ROOM_NAME_MAX = 60;

export function getRoomById(house: HouseRooms, roomId: string): Room | undefined {
  return house.rooms.find((room) => room.id === roomId);
}

/** The room a visitor lands in (entry room, falling back to the first room). */
export function entryRoom(house: HouseRooms): Room {
  return getRoomById(house, house.entryRoomId) ?? house.rooms[0];
}

/** Repair invariants on load: entry id must reference a real room. */
export function normalizeHouse(house: HouseRooms): HouseRooms {
  const rooms = house.rooms ?? [];
  const entryRoomId = rooms.some((room) => room.id === house.entryRoomId) ? house.entryRoomId : rooms[0]?.id;
  return { shopAddress: house.shopAddress, entryRoomId, rooms };
}

/** Wrap a single (possibly legacy) Room into a one-room house. */
export function houseFromRoom(room: Room): HouseRooms {
  return { shopAddress: room.shopAddress, entryRoomId: room.id, rooms: [room] };
}

/** A furnished single-room house derived from the shop (the default before edits). */
export function deriveDefaultHouse(shop: Shop): HouseRooms {
  const room = deriveDefaultRoom(shop);
  return { shopAddress: shop.address, entryRoomId: room.id, rooms: [room] };
}

/** Replace a room (matched by id) with a new version. */
export function withRoom(house: HouseRooms, room: Room): HouseRooms {
  return { ...house, rooms: house.rooms.map((existing) => (existing.id === room.id ? room : existing)) };
}

/** A fresh empty room for the house (unique id). */
export function createNamedRoom(shopAddress: string, name: string, type: RoomKind = "custom", description = ""): Room {
  const room = createRoom(shopAddress, name.trim().slice(0, ROOM_NAME_MAX) || "New room", type, nextRoomId(shopAddress));
  return { ...room, description };
}

/** Append a room, regenerating its id if it would collide (no duplicate ids). */
export function addRoom(house: HouseRooms, room: Room): HouseRooms {
  const safe = house.rooms.some((existing) => existing.id === room.id)
    ? { ...room, id: nextRoomId(house.shopAddress) }
    : room;
  return { ...house, rooms: [...house.rooms, safe] };
}

export function renameRoom(house: HouseRooms, roomId: string, name: string): HouseRooms {
  const trimmed = name.trim().slice(0, ROOM_NAME_MAX);
  if (!trimmed) return house;
  return { ...house, rooms: house.rooms.map((room) => (room.id === roomId ? { ...room, name: trimmed } : room)) };
}

export function updateRoomMeta(house: HouseRooms, roomId: string, patch: { name?: string; type?: RoomKind; description?: string }): HouseRooms {
  return {
    ...house,
    rooms: house.rooms.map((room) => {
      if (room.id !== roomId) return room;
      const next = { ...room };
      if (patch.name !== undefined && patch.name.trim()) next.name = patch.name.trim().slice(0, ROOM_NAME_MAX);
      if (patch.type !== undefined) next.type = patch.type;
      if (patch.description !== undefined) next.description = patch.description;
      return next;
    }),
  };
}

export function setEntryRoom(house: HouseRooms, roomId: string): HouseRooms {
  if (!house.rooms.some((room) => room.id === roomId)) return house;
  return { ...house, entryRoomId: roomId };
}

/** Why a room can't be deleted, or ok. A house keeps ≥1 room, and a room must be
 * emptied of objects first (so links/content aren't silently dropped). */
export function canDeleteRoom(house: HouseRooms, roomId: string): { ok: boolean; reason?: string } {
  if (house.rooms.length <= 1) return { ok: false, reason: "A house needs at least one room." };
  const room = getRoomById(house, roomId);
  if (!room) return { ok: false, reason: "Room not found." };
  if (room.objects.length > 0) return { ok: false, reason: "Empty the room before deleting it." };
  return { ok: true };
}

/** Delete a room if allowed; reassigns the entry room and clears any door links
 * that pointed at it. No-op when `canDeleteRoom` says no. */
export function deleteRoom(house: HouseRooms, roomId: string): HouseRooms {
  if (!canDeleteRoom(house, roomId).ok) return house;
  const remaining = house.rooms
    .filter((room) => room.id !== roomId)
    .map((room) => ({
      ...room,
      objects: room.objects.map((object) =>
        object.actionType === "room_link" && object.actionData?.targetRoomId === roomId
          ? { ...object, actionData: { ...object.actionData, targetRoomId: undefined } }
          : object,
      ),
    }));
  const entryRoomId = house.entryRoomId === roomId ? remaining[0].id : house.entryRoomId;
  return { ...house, rooms: remaining, entryRoomId };
}

/** Is a door/stairs target a real room in this house? */
export function isValidRoomLink(house: HouseRooms, targetRoomId?: string): boolean {
  return !!targetRoomId && house.rooms.some((room) => room.id === targetRoomId);
}

/** Rooms a connector in `fromRoomId` may link to (everything but itself). */
export function roomLinkTargets(house: HouseRooms, fromRoomId: string): { id: string; name: string }[] {
  return house.rooms.filter((room) => room.id !== fromRoomId).map((room) => ({ id: room.id, name: room.name }));
}
