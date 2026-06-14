import { describe, it, expect, beforeEach } from "vitest";
import { deleteDraft, getDraft, getDrafts, saveDraft } from "@/lib/room-design-drafts";
import { generateRoomDesign } from "@/lib/ai-room-designer";

const ADDRESS = "moon.test.room";

function makeDesign(brief = "a cozy reading room") {
  return generateRoomDesign({ brief, address: ADDRESS, style: "cozy" });
}

function draftInput(name = "Reading room") {
  const design = makeDesign();
  return {
    shopAddress: ADDRESS,
    name,
    brief: "a cozy reading room",
    style: design.style,
    intentId: design.intentId,
    parsed: design.parsed,
    room: design.room,
  };
}

describe("room design drafts store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty for a house", () => {
    expect(getDrafts(ADDRESS)).toEqual([]);
  });

  it("saves a draft and reads it back", () => {
    const saved = saveDraft(draftInput("Draft A"));
    expect(saved.id).toBeTruthy();
    expect(saved.createdAt).toBeTruthy();
    const drafts = getDrafts(ADDRESS);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("Draft A");
    expect(drafts[0].room.objects.length).toBeGreaterThan(0);
  });

  it("keeps multiple drafts for a house", () => {
    saveDraft(draftInput("Older"));
    saveDraft(draftInput("Newer"));
    const names = getDrafts(ADDRESS).map((d) => d.name);
    expect(names).toContain("Older");
    expect(names).toContain("Newer");
    expect(names).toHaveLength(2);
  });

  it("scopes drafts per house address", () => {
    saveDraft(draftInput("Mine"));
    saveDraft({ ...draftInput("Theirs"), shopAddress: "other.house.here" });
    expect(getDrafts(ADDRESS)).toHaveLength(1);
    expect(getDrafts("other.house.here")).toHaveLength(1);
  });

  it("finds a draft by id across houses", () => {
    const saved = saveDraft(draftInput("Findable"));
    expect(getDraft(saved.id)?.name).toBe("Findable");
    expect(getDraft("draft-missing")).toBeNull();
  });

  it("deletes a draft", () => {
    const a = saveDraft(draftInput("Keep"));
    const b = saveDraft(draftInput("Remove"));
    deleteDraft(ADDRESS, b.id);
    const remaining = getDrafts(ADDRESS);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(a.id);
  });

  it("applying a draft means reading back its stored room (still valid)", () => {
    const saved = saveDraft(draftInput("Applyable"));
    const reloaded = getDraft(saved.id);
    expect(reloaded?.room.objects).toEqual(saved.room.objects);
  });
});
