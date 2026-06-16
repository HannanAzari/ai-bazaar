import { describe, it, expect } from "vitest";
import { makeReviewAction } from "@/lib/activity";
import { sampleCandidates } from "@/lib/sample-data";

describe("review action builder", () => {
  const candidate = sampleCandidates()[0];

  it("captures candidate, action, and reviewer", () => {
    const a = makeReviewAction(candidate, "approved", "Hannah");
    expect(a.candidateId).toBe(candidate.id);
    expect(a.candidateName).toBe(candidate.name);
    expect(a.action).toBe("approved");
    expect(a.reviewer).toBe("Hannah");
    expect(a.note).toBeUndefined();
    expect(new Date(a.createdAt).toString()).not.toBe("Invalid Date");
  });

  it("falls back to 'anonymous' for a blank reviewer and trims notes", () => {
    const a = makeReviewAction(candidate, "rejected", "   ", "  off-style  ");
    expect(a.reviewer).toBe("anonymous");
    expect(a.note).toBe("off-style");
  });

  it("produces unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeReviewAction(candidate, "needs_edit", "h").id));
    expect(ids.size).toBe(50);
  });
});
