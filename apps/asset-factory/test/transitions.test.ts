import { describe, it, expect } from "vitest";
import { applyTransition, canTransition, approve, reject } from "@/lib/transitions";
import { candidateFromImport } from "@/lib/validation";
import type { AssetCandidate } from "@/lib/types";

function clean(): AssetCandidate {
  return candidateFromImport({
    name: "Review Me",
    category: "table",
    imageUrl: "https://cdn.example.com/review-me.png",
    width: 1024,
    height: 1024,
    transparent: true,
    tags: ["table"],
  });
}

describe("review transitions", () => {
  it("allows review outcomes from needs_review", () => {
    expect(canTransition("needs_review", "approved")).toBe(true);
    expect(canTransition("needs_review", "rejected")).toBe(true);
    expect(canTransition("needs_review", "needs_edit")).toBe(true);
  });

  it("treats a same-status move as a no-op", () => {
    const c = clean();
    expect(canTransition("needs_review", "needs_review")).toBe(false);
    expect(applyTransition(c, "needs_review", "h")).toBe(c);
  });

  it("approve stamps reviewer + reviewedAt", () => {
    const c = clean();
    const next = approve(c, "hannan");
    expect(next.status).toBe("approved");
    expect(next.reviewer).toBe("hannan");
    expect(next.reviewedAt).not.toBe("");
    expect(c.status).toBe("needs_review"); // input not mutated
  });

  it("reject stamps the reviewer", () => {
    const next = reject(clean(), "helper");
    expect(next.status).toBe("rejected");
    expect(next.reviewer).toBe("helper");
  });

  it("refuses to approve a candidate with critical issues", () => {
    const broken = { ...clean(), imageUrl: "", localPath: undefined };
    const next = applyTransition(broken, "approved", "hannan");
    expect(next.status).toBe("needs_review"); // unchanged
  });

  it("can move an approved asset back to review", () => {
    const approved = approve(clean(), "h");
    expect(canTransition("approved", "needs_review")).toBe(true);
    expect(applyTransition(approved, "needs_review", "h").status).toBe("needs_review");
  });
});
