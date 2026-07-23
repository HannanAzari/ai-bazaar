import { describe, expect, it } from "vitest";
import { compileAssetPrompt, compileAvatarPrompt, compileNestPrompt, PROMPT_COMPILER_VERSION } from "@/lib/art-engine/compiler";
import { VISUAL_DNA, VISUAL_DNA_VERSION } from "@/lib/visual-dna";
import { reviewCriteria } from "@/lib/art-engine/validators";
import { GOLDEN_REFERENCES, goldenApprovalSummary } from "@/lib/art-engine/golden-references";

describe("Art Engine compiler — one source of truth", () => {
  it("all three compilers embed the shared Visual DNA + versions", () => {
    for (const compiled of [compileAvatarPrompt(["x"]), compileAssetPrompt(["x"]), compileNestPrompt(["x"])]) {
      expect(compiled.positive).toContain(VISUAL_DNA_VERSION);
      expect(compiled.meta.visualDnaVersion).toBe(VISUAL_DNA_VERSION);
      expect(compiled.meta.compilerVersion).toBe(PROMPT_COMPILER_VERSION);
      expect(compiled.negative).toMatch(/flat vector/);
    }
  });

  it("PROPAGATION: changing ONE shared property flows into ALL three compiled prompts", () => {
    const marker = "ZZ_SHADOW_MARKER_9931";
    const patched = { ...VISUAL_DNA, shadowLanguage: marker };
    expect(compileAvatarPrompt(["x"], patched).positive).toContain(marker);
    expect(compileAssetPrompt(["x"], patched).positive).toContain(marker);
    expect(compileNestPrompt(["x"], patched).positive).toContain(marker);
  });

  it("type-specific clauses differ per type", () => {
    expect(compileAvatarPrompt(["x"]).positive).toMatch(/FULL-BODY/i);
    expect(compileNestPrompt(["x"]).positive).toMatch(/EMPTY interior room/i);
    expect(compileAssetPrompt(["x"]).positive).toMatch(/MATERIAL TRUTH/i);
  });

  it("subject clauses reach the compiled prompt", () => {
    expect(compileAvatarPrompt(["a person wearing round glasses"]).positive).toContain("round glasses");
  });

  it("validators derive shared + type criteria from one source", () => {
    const avatar = reviewCriteria("avatar");
    expect(avatar.some((c) => c.scope === "shared" && c.key === "warmth")).toBe(true);
    expect(avatar.some((c) => c.scope === "type" && c.key === "resemblance")).toBe(true);
    expect(reviewCriteria("nest").some((c) => c.key === "empty placement zones")).toBe(true);
  });

  it("five Golden References are versioned against the engine", () => {
    expect(GOLDEN_REFERENCES).toHaveLength(5);
    for (const g of GOLDEN_REFERENCES) {
      expect(g.visualDnaVersion).toBe(VISUAL_DNA_VERSION);
      expect(g.compilerVersion).toBe(PROMPT_COMPILER_VERSION);
    }
    expect(goldenApprovalSummary()).toEqual({ total: 5, approved: 0, pending: 5 });
  });
});
