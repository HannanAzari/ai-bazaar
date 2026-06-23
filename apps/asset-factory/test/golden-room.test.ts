import { describe, it, expect } from "vitest";
import {
  clampCount,
  normalizeScore,
  isGoldenRoomStatus,
  isWinner,
  bestCandidate,
  nextRound,
  buildRoomShellPackExport,
  WINNER_THRESHOLD,
  MAX_PER_ROUND,
  GOLDEN_ROOM_SCENE_AREAS,
  GOLDEN_ROOM_PROMPT,
  GOLDEN_ROOM_NEGATIVE,
  type GoldenRoomCandidate,
} from "@/lib/golden-room";

function cand(p: Partial<GoldenRoomCandidate>): GoldenRoomCandidate {
  return {
    id: "x", round: 1, imageUrl: "/img", prompt: "p", negativePrompt: "n",
    score: null, critique: "", status: "pending", dryRun: false, createdAt: "t", ...p,
  };
}

describe("golden-room clampCount", () => {
  it("clamps to [1, MAX_PER_ROUND]", () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(3)).toBe(3);
    expect(clampCount(99)).toBe(MAX_PER_ROUND);
    expect(clampCount(Number.NaN)).toBe(1);
    expect(clampCount(2.9)).toBe(2);
  });
});

describe("golden-room normalizeScore", () => {
  it("returns null for empty, clamps + rounds otherwise", () => {
    expect(normalizeScore("")).toBeNull();
    expect(normalizeScore(null)).toBeNull();
    expect(normalizeScore("abc")).toBeNull();
    expect(normalizeScore(150)).toBe(100);
    expect(normalizeScore(-5)).toBe(0);
    expect(normalizeScore(86.6)).toBe(87);
  });
});

describe("golden-room status guard", () => {
  it("accepts only valid statuses", () => {
    expect(isGoldenRoomStatus("approved")).toBe(true);
    expect(isGoldenRoomStatus("rejected")).toBe(true);
    expect(isGoldenRoomStatus("pending")).toBe(true);
    expect(isGoldenRoomStatus("winner")).toBe(false);
  });
});

describe("golden-room isWinner", () => {
  it("requires approved AND score >= threshold", () => {
    expect(isWinner(cand({ status: "approved", score: WINNER_THRESHOLD }))).toBe(true);
    expect(isWinner(cand({ status: "approved", score: 84 }))).toBe(false);
    expect(isWinner(cand({ status: "pending", score: 99 }))).toBe(false);
    expect(isWinner(cand({ status: "approved", score: null }))).toBe(false);
  });
});

describe("golden-room bestCandidate / nextRound", () => {
  it("picks the highest score; null when none scored", () => {
    expect(bestCandidate([])).toBeNull();
    expect(bestCandidate([cand({ id: "a" })])).toBeNull();
    const best = bestCandidate([cand({ id: "a", score: 70 }), cand({ id: "b", score: 88 })]);
    expect(best?.id).toBe("b");
  });
  it("nextRound is max round + 1", () => {
    expect(nextRound([])).toBe(1);
    expect(nextRound([cand({ round: 1 }), cand({ round: 3 })])).toBe(4);
  });
});

describe("golden-room export", () => {
  it("builds a RoomShellPack with the four scene areas", () => {
    const pack = buildRoomShellPackExport(cand({ id: "win", imageUrl: "/api/golden-room/image/win" }));
    expect(pack.type).toBe("room_shell_pack");
    expect(pack.id).toBe("golden-room-v1");
    expect(pack.version).toBe("1.0.0");
    expect(pack.imageUrl).toBe("/api/golden-room/image/win");
    expect(pack.sceneAreas).toHaveLength(4);
    expect(pack.sceneAreas.map((a) => a.id)).toEqual(["media-area", "work-area", "gallery-area", "achievement-area"]);
    expect(GOLDEN_ROOM_SCENE_AREAS[0].recommendedFor).toContain("youtube");
  });
});

describe("golden-room prompts", () => {
  it("anchor prompt avoids banned cues and asks for neutral wall areas", () => {
    expect(GOLDEN_ROOM_PROMPT.toLowerCase()).toContain("parallel projection");
    expect(GOLDEN_ROOM_PROMPT.toLowerCase()).toContain("neutral");
    expect(GOLDEN_ROOM_NEGATIVE).toContain("text");
    expect(GOLDEN_ROOM_NEGATIVE).toContain("people");
  });
});
