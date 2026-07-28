import { describe, it, expect } from "vitest";
import { buildReferencePrompt, REFERENCE_STUDIO_VERSION, REFERENCE_SIZE } from "@/lib/asset-pipeline/reference-studio";

// The Reference Studio's value is CONSISTENCY: every reference shares one visual language,
// only the subject changes. These lock that guarantee.

describe("reference studio prompt", () => {
  it("stamps a truthful version + square resolution", () => {
    expect(REFERENCE_STUDIO_VERSION).toBe("ref-studio@1");
    expect(REFERENCE_SIZE).toBe(1024);
  });

  it("names the subject but keeps camera / lighting / background / framing identical", () => {
    const a = buildReferencePrompt("mirrorless camera");
    const b = buildReferencePrompt("over-ear headphones");
    expect(a).toMatch(/mirrorless camera/);
    expect(b).toMatch(/over-ear headphones/);
    // the fixed studio clauses appear verbatim in both
    for (const p of [a, b]) {
      expect(p).toMatch(/CAMERA \(identical for every reference\)/);
      expect(p).toMatch(/pure-white studio sweep/);
      expect(p).toMatch(/soft, even, neutral studio lighting/);
      expect(p).toMatch(/filling about 65 percent/);
      expect(p).toMatch(/LEFT-RIGHT SYMMETRIC/); // feeds pose determinism
      expect(p).toMatch(/PRODUCT PHOTOGRAPH/);
      expect(p).toMatch(/BRAND-NEUTRAL/); // Beta brand policy
      expect(p).toMatch(/NO logos/);
    }
    // everything except the subject line is identical between the two prompts
    const strip = (s: string) => s.replace(/mirrorless camera|over-ear headphones/g, "OBJ");
    expect(strip(a)).toBe(strip(b));
  });

  it("front-facing, not a strong three-quarter (for downstream pose determinism)", () => {
    const p = buildReferencePrompt("laptop");
    expect(p).toMatch(/straight-on FRONT view/);
    expect(p).toMatch(/never rotated to a side or a strong three-quarter/);
  });
});
