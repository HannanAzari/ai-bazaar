import { describe, it, expect } from "vitest";
import { generateCreatorRoom } from "@/lib/creator-analyzer";
import { houseFromRoom } from "@/lib/house";
import { houseFromRows, rowsFromHouse } from "@/lib/repos/supabase-mappers";

// Onboarding V1 reaches a first room by: answers → Creator Auto Build → wrap as a
// house → persist. The page wiring is component-level; this verifies the data path
// it produces is valid and round-trips through the persistence mappers.

const ADDRESS = "moon.new.creator";

describe("onboarding flow (data path)", () => {
  it("turns answers into a furnished, persistable first room", () => {
    const built = generateCreatorRoom(
      { instagramUrl: "instagram.com/jane", youtubeUrl: "youtube.com/@jane", bio: "Wedding photographer taking bookings" },
      ADDRESS,
    );
    // A profile object, social objects, and a welcome message are present.
    expect(built.profileCreated).toBe(true);
    expect(built.socialObjects).toBe(2);
    expect(built.result.room.description).toMatch(/^Welcome to my/);
    expect(built.result.room.objects.length).toBeGreaterThan(0);

    const house = houseFromRoom(built.result.room);
    expect(house.shopAddress).toBe(ADDRESS);
    expect(house.entryRoomId).toBe(built.result.room.id);
  });

  it("round-trips the onboarding room through the persistence layer", () => {
    const built = generateCreatorRoom({ bio: "Indie developer building tools" }, ADDRESS);
    const house = houseFromRoom(built.result.room);
    const rows = rowsFromHouse(house, "shop-uuid");
    const back = houseFromRows(ADDRESS, rows);
    expect(back.rooms[0].objects.map((o) => o.assetId)).toEqual(built.result.room.objects.map((o) => o.assetId));
    expect(back.rooms[0].description).toBe(built.result.room.description);
    expect(back.entryRoomId).toBe(house.entryRoomId);
  });

  it("is deterministic for the same answers", () => {
    const input = { instagramUrl: "instagram.com/jane", bio: "Ceramic artist" };
    const a = generateCreatorRoom(input, ADDRESS);
    const b = generateCreatorRoom(input, ADDRESS);
    expect(a.result.room.objects.map((o) => o.assetId)).toEqual(b.result.room.objects.map((o) => o.assetId));
    expect(a.welcome).toBe(b.welcome);
  });
});
