import type { HouseRooms, Room, Shop } from "@/lib/types";
import { deriveDefaultHouse, houseFromRoom, normalizeHouse } from "@/lib/house";

// Demo room store. A house's set of rooms persists in localStorage keyed by
// house address; production writes the same shape to the Supabase `rooms` /
// `room_objects` tables (see schema.sql). Houses without a saved layout fall
// back to a derived default so every public room looks furnished.
//
// V4 stores a multi-room HouseRooms per address. Layouts saved before V4 are a
// single Room — they are migrated on read into a one-room house (that room
// becomes the entry room), so no saved layout is lost and the key is unchanged.

const STORAGE_KEY = "ai-bazaar-rooms";

type Stored = HouseRooms | Room;
type Store = Record<string, Stored>;

function isHouse(value: Stored): value is HouseRooms {
  return !!value && Array.isArray((value as HouseRooms).rooms);
}

function readAll(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function writeAll(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("ai-bazaar-rooms-changed"));
}

function toHouse(value: Stored): HouseRooms {
  return normalizeHouse(isHouse(value) ? value : houseFromRoom(value as Room));
}

// ── House-level API (V4) ──

/** The saved house for an address, or null if it has never been edited. */
export function getStoredHouse(address: string): HouseRooms | null {
  const value = readAll()[address];
  return value ? toHouse(value) : null;
}

/** The house to render: the saved one, else a derived single-room default. */
export function getHouse(shop: Shop): HouseRooms {
  return getStoredHouse(shop.address) ?? deriveDefaultHouse(shop);
}

export function saveHouse(house: HouseRooms) {
  const store = readAll();
  store[house.shopAddress] = normalizeHouse(house);
  writeAll(store);
}

/** Forget the saved house so it reverts to its derived default. */
export function resetHouse(address: string) {
  const store = readAll();
  delete store[address];
  writeAll(store);
}

// ── Back-compat single-room API (operates on the entry room) ──

export function getStoredRoom(address: string): Room | null {
  const house = getStoredHouse(address);
  if (!house) return null;
  return house.rooms.find((room) => room.id === house.entryRoomId) ?? house.rooms[0] ?? null;
}

export function getRoom(shop: Shop): Room {
  const house = getHouse(shop);
  return house.rooms.find((room) => room.id === house.entryRoomId) ?? house.rooms[0];
}

/** Upsert a single room into its house (creating a one-room house if none). */
export function saveRoom(room: Room) {
  const existing = getStoredHouse(room.shopAddress);
  if (!existing) {
    saveHouse({ shopAddress: room.shopAddress, entryRoomId: room.id, rooms: [room] });
    return;
  }
  const rooms = existing.rooms.some((r) => r.id === room.id)
    ? existing.rooms.map((r) => (r.id === room.id ? room : r))
    : [...existing.rooms, room];
  saveHouse({ ...existing, rooms });
}

export function resetRoom(address: string) {
  resetHouse(address);
}
