import { describe, it, expect } from "vitest";
import {
  candidateToRow,
  rowToCandidate,
  actionToRow,
  rowToAction,
} from "@/lib/mappers";
import { sampleCandidates } from "@/lib/sample-data";
import { candidateFromImport } from "@/lib/validation";
import { makeReviewAction } from "@/lib/activity";

describe("supabase row mappers", () => {
  it("round-trips a sample candidate through a row", () => {
    const c = sampleCandidates()[0];
    expect(rowToCandidate(candidateToRow(c))).toEqual(c);
  });

  it("maps camelCase fields to snake_case columns", () => {
    const c = sampleCandidates().find((x) => x.status === "approved")!;
    const row = candidateToRow(c);
    expect(row.image_url).toBe(c.imageUrl);
    expect(row.default_action_type).toBe(c.defaultActionType);
    expect(row.compatible_zones).toEqual(c.compatibleZones);
    expect(row.reviewed_at).toBe(c.reviewedAt);
  });

  it("normalizes an absent localPath to null and back to undefined", () => {
    const c = candidateFromImport({
      name: "No Local Path",
      category: "chair",
      imageUrl: "https://cdn.example.com/x.png",
      width: 1024,
      height: 1024,
      tags: ["chair"],
    });
    const row = candidateToRow(c);
    expect(row.local_path).toBeNull();
    expect(rowToCandidate(row).localPath).toBeUndefined();
  });

  it("round-trips a review action (note undefined <-> null)", () => {
    const c = sampleCandidates()[0];
    const action = makeReviewAction(c, "approved", "Hannah");
    expect(rowToAction(actionToRow(action))).toEqual(action);
    expect(actionToRow(action).note).toBeNull();
  });
});
