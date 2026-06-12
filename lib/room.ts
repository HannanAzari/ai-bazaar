import type { Room, Shop } from "@/lib/types";
import { deriveDefaultRoom } from "@/lib/room-schema";

// Demo room store. Owner-edited room layouts persist in localStorage keyed by
// house address; production writes the same shape to the Supabase `rooms` /
// `room_objects` tables (see schema.sql). Houses without a saved layout fall
// back to a derived default so every public room looks furnished.

const STORAGE_KEY = "ai-bazaar-rooms";

type Store = Record<string, Room>;

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

/** The saved layout for a house, or null if it has never been edited. */
export function getStoredRoom(address: string): Room | null {
  return readAll()[address] ?? null;
}

/** The room to render: the saved layout, else a derived default. */
export function getRoom(shop: Shop): Room {
  return getStoredRoom(shop.address) ?? deriveDefaultRoom(shop);
}

export function saveRoom(room: Room) {
  const store = readAll();
  store[room.shopAddress] = room;
  writeAll(store);
}

/** Forget the saved layout so the house reverts to its derived default. */
export function resetRoom(address: string) {
  const store = readAll();
  delete store[address];
  writeAll(store);
}
