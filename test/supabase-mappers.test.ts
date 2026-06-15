import { describe, it, expect } from "vitest";
import { type RoomRow, houseFromRows, rowToRoom, roomToRow, rowsFromHouse } from "@/lib/repos/supabase-mappers";
import { generateCreatorRoom } from "@/lib/creator-analyzer";
import { deriveDefaultHouse } from "@/lib/house";
import type { Shop } from "@/lib/types";

const ADDRESS = "moon.test.room";
const SHOP_ID = "shop-uuid-1";

const shop = (): Shop => ({
  id: "s1", address: ADDRESS, bazaarId: "b1", slotNumber: 1, name: "Test", owner: "T", ownerHandle: "@t",
  tagline: "", bio: "", avatar: "", palette: "", cover: "", likes: 0, followers: 0, visitors: 0,
  createdAt: "2026-06-23", links: [], decorations: [],
});

describe("room ↔ row mapping", () => {
  it("round-trips a generated room through row form (objects, bg, type, description)", () => {
    const built = generateCreatorRoom({ instagramUrl: "instagram.com/jane", bio: "Wedding photographer" }, ADDRESS);
    const room = { ...built.result.room, description: "Welcome!" };
    const row = roomToRow(room, SHOP_ID, true);
    expect(row).toMatchObject({ shop_id: SHOP_ID, client_id: room.id, background: room.background, type: room.type, is_entry: true });
    const back = rowToRoom(row as RoomRow, ADDRESS);
    expect(back.id).toBe(room.id);
    expect(back.shopAddress).toBe(ADDRESS);
    expect(back.description).toBe("Welcome!");
    expect(back.objects.map((o) => o.assetId)).toEqual(room.objects.map((o) => o.assetId));
    expect(back.zones.length).toBe(room.zones.length); // zones re-cloned from the template
  });

  it("defaults a null objects column to an empty array", () => {
    const row: RoomRow = { shop_id: SHOP_ID, client_id: "room-x", name: "X", type: "studio", description: null, theme: "warm", background: "standard", is_entry: false, objects: null };
    expect(rowToRoom(row, ADDRESS).objects).toEqual([]);
  });
});

describe("house ↔ rows mapping", () => {
  it("builds rows from a house with the entry room flagged", () => {
    const house = deriveDefaultHouse(shop());
    const rows = rowsFromHouse(house, SHOP_ID);
    expect(rows.length).toBe(house.rooms.length);
    const entryRows = rows.filter((r) => r.is_entry);
    expect(entryRows).toHaveLength(1);
    expect(entryRows[0].client_id).toBe(house.entryRoomId);
  });

  it("reconstructs a house from rows, restoring the entry pointer", () => {
    const house = deriveDefaultHouse(shop());
    const rows = rowsFromHouse(house, SHOP_ID);
    const back = houseFromRows(ADDRESS, rows);
    expect(back.shopAddress).toBe(ADDRESS);
    expect(back.entryRoomId).toBe(house.entryRoomId);
    expect(back.rooms.map((r) => r.id).sort()).toEqual(house.rooms.map((r) => r.id).sort());
  });

  it("falls back to the first room when no is_entry flag is set", () => {
    const house = deriveDefaultHouse(shop());
    const rows = rowsFromHouse(house, SHOP_ID).map((r) => ({ ...r, is_entry: false }));
    const back = houseFromRows(ADDRESS, rows);
    expect(back.entryRoomId).toBe(rows[0].client_id);
  });
});
