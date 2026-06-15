import type { HouseRooms, Room, RoomObject, RoomKind } from "@/lib/types";
import { cloneZones } from "@/lib/room-schema";
import { normalizeHouse } from "@/lib/house";

// Pure row↔model mappers for the Supabase room persistence (V1 jsonb shape).
// Kept separate from the repository so they're unit-testable without a network.

export type RoomRow = {
  id?: string;
  shop_id: string;
  client_id: string;
  name: string;
  type: string;
  description: string | null;
  theme: string;
  background: string;
  is_entry: boolean;
  objects: RoomObject[] | null;
};

/** A DB room row → the app Room model (zones are re-cloned from the template). */
export function rowToRoom(row: RoomRow, shopAddress: string): Room {
  return {
    id: row.client_id,
    shopAddress,
    name: row.name,
    type: row.type as RoomKind,
    description: row.description ?? "",
    theme: row.theme,
    background: row.background,
    zones: cloneZones(),
    objects: Array.isArray(row.objects) ? row.objects : [],
  };
}

/** The app Room → a DB row for upsert (zones are app-defined, never persisted). */
export function roomToRow(room: Room, shopId: string, isEntry: boolean): RoomRow {
  return {
    shop_id: shopId,
    client_id: room.id,
    name: room.name,
    type: room.type,
    description: room.description ?? "",
    theme: room.theme,
    background: room.background,
    is_entry: isEntry,
    objects: room.objects,
  };
}

/** All of a house's room rows → a HouseRooms (entry = the is_entry row). */
export function houseFromRows(shopAddress: string, rows: RoomRow[]): HouseRooms {
  const rooms = rows.map((r) => rowToRoom(r, shopAddress));
  const entryRow = rows.find((r) => r.is_entry) ?? rows[0];
  return normalizeHouse({
    shopAddress,
    entryRoomId: entryRow ? entryRow.client_id : rooms[0]?.id ?? "",
    rooms,
  });
}

/** A HouseRooms → the set of room rows to upsert. */
export function rowsFromHouse(house: HouseRooms, shopId: string): RoomRow[] {
  return house.rooms.map((room) => roomToRow(room, shopId, room.id === house.entryRoomId));
}
