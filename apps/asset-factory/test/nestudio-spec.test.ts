import { describe, it, expect } from "vitest";
import {
  NESTUDIO_CAMERA_SPEC_V1,
  NESTUDIO_OBJECT_RULES_V1,
  NESTUDIO_SPECS,
  specPromptFragment,
  allForbiddenTokens,
  specViolations,
  obeysNestudioSpecs,
} from "@/lib/nestudio-spec";
import { MASTER_PROMPT } from "@/lib/prompts";

describe("Nestudio Camera Spec V1 (Task 2)", () => {
  it("locks a single 3/4 isometric ~30-degree camera", () => {
    expect(NESTUDIO_CAMERA_SPEC_V1.id).toBe("nestudio_camera_v1");
    const rules = NESTUDIO_CAMERA_SPEC_V1.rules.join(" ").toLowerCase();
    expect(rules).toContain("3/4 isometric");
    expect(rules).toContain("30-degree");
    expect(rules).toContain("centered");
    expect(rules).toContain("no cropping");
  });

  it("forbids floors, pedestals, scenes, and off-camera angles", () => {
    for (const token of ["pedestal", "floor plane", "room scene", "front view", "side view", "cropped"]) {
      expect(NESTUDIO_CAMERA_SPEC_V1.forbidden).toContain(token);
    }
  });

  it("its prompt fragment obeys its own rules", () => {
    expect(specViolations(NESTUDIO_CAMERA_SPEC_V1.promptFragment, NESTUDIO_CAMERA_SPEC_V1)).toEqual([]);
  });
});

describe("Nestudio Object Rules V1 (Task 3)", () => {
  it("requires exactly one isolated object on transparent background", () => {
    expect(NESTUDIO_OBJECT_RULES_V1.id).toBe("nestudio_object_v1");
    const rules = NESTUDIO_OBJECT_RULES_V1.rules.join(" ").toLowerCase();
    expect(rules).toContain("exactly one object");
    expect(rules).toContain("transparent");
    expect(rules).toContain("no extra props");
  });

  it("forbids extra props, secondary objects, and scenes", () => {
    for (const token of ["multiple objects", "furniture set", "extra props", "side table", "secondary object"]) {
      expect(NESTUDIO_OBJECT_RULES_V1.forbidden).toContain(token);
    }
  });

  it("its prompt fragment obeys its own rules", () => {
    expect(specViolations(NESTUDIO_OBJECT_RULES_V1.promptFragment, NESTUDIO_OBJECT_RULES_V1)).toEqual([]);
  });
});

describe("spec helpers", () => {
  it("exposes both specs", () => {
    expect(NESTUDIO_SPECS).toHaveLength(2);
  });

  it("combines fragments and forbidden tokens", () => {
    const frag = specPromptFragment();
    expect(frag).toContain("isolated object");
    expect(frag).toContain("isometric");
    expect(allForbiddenTokens().length).toBeGreaterThan(0);
    // De-duplicated (white background appears in both lists once unioned).
    expect(new Set(allForbiddenTokens()).size).toBe(allForbiddenTokens().length);
  });

  it("detects violations and a clean prompt", () => {
    expect(specViolations("a single chair on a pedestal", NESTUDIO_CAMERA_SPEC_V1)).toContain("pedestal");
    expect(obeysNestudioSpecs("a single chair, centered, isometric")).toBe(true);
    expect(obeysNestudioSpecs("a chair with a side table and a floor plane")).toBe(false);
  });

  it("the live MASTER_PROMPT obeys both locked specs", () => {
    expect(obeysNestudioSpecs(MASTER_PROMPT)).toBe(true);
  });
});
