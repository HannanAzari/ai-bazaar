import { describe, expect, it } from "vitest";
import {
  AVATAR_IDENTITY_VERSION,
  AVATAR_BODY_VERSION,
  DEFAULT_AVATAR_BODY,
  STYLE_PRESETS,
  buildIdentityCapturePrompt,
  buildCharacterAssemblyPrompt,
  type AvatarBody,
  type AvatarStylePreset,
} from "@/lib/avatar-factory/identity";

describe("avatar identity engine — contracts", () => {
  it("versions the identity and body objects", () => {
    expect(AVATAR_IDENTITY_VERSION).toBe("avatar-identity-v1");
    expect(AVATAR_BODY_VERSION).toBe("avatar-body-v1");
    expect(DEFAULT_AVATAR_BODY.version).toBe(AVATAR_BODY_VERSION);
  });

  it("has three genuinely distinct style presets (presentation, not identity)", () => {
    const keys = Object.keys(STYLE_PRESETS) as AvatarStylePreset[];
    expect(keys).toEqual(["soft", "balanced", "bold"]);
    // each preset must differ from the others on every axis
    const palettes = keys.map((k) => STYLE_PRESETS[k].palette);
    const postures = keys.map((k) => STYLE_PRESETS[k].posture);
    expect(new Set(palettes).size).toBe(3);
    expect(new Set(postures).size).toBe(3);
    // bold is the strongest silhouette
    expect(STYLE_PRESETS.bold.posture).toMatch(/confident|stronger|grounded/i);
  });
});

describe("Stage 1 — Identity Capture", () => {
  const { positive, negative } = buildIdentityCapturePrompt();

  it("captures identity features (WHO)", () => {
    for (const feature of ["face shape", "eye shape", "eyebrows", "nose", "mouth", "hairstyle", "skin tone", "glasses"]) {
      expect(positive.toLowerCase()).toContain(feature);
    }
    expect(positive).toMatch(/same person|unmistakably this person/i);
  });

  it("refuses to render the body (head only)", () => {
    expect(positive.toLowerCase()).toMatch(/head, face, hair and neckline only/);
    for (const banned of ["body", "full body", "clothing", "hands", "pose"]) {
      expect(negative.toLowerCase()).toContain(banned);
    }
  });

  it("prioritises resemblance over the mascot collapse", () => {
    expect(positive).toMatch(/resemblance beats stylisation/i);
    for (const banned of ["generic face", "different person", "changed features", "average face"]) {
      expect(negative).toContain(banned);
    }
  });
});

describe("Stage 2 — Character Assembly", () => {
  const body: AvatarBody = { ...DEFAULT_AVATAR_BODY, build: "athletic", shoulders: "broad", height: "tall" };

  it("holds the identity fixed and builds the body around it", () => {
    const { positive, negative } = buildCharacterAssemblyPrompt(body, "balanced");
    expect(positive).toMatch(/preserve the person from the original photo/i);
    expect(positive).toMatch(/do not redesign the person/i);
    // the body contract is present and specific
    expect(positive).toContain("athletic");
    expect(positive).toContain("broad shoulders");
    expect(positive).toContain("tall height");
    // guards against re-inventing the face
    for (const banned of ["different face", "regenerated face", "generic face", "rounded mascot"]) {
      expect(negative).toContain(banned);
    }
  });

  it("carries the shared Visual DNA into Stage 2 (read-only)", () => {
    const { positive } = buildCharacterAssemblyPrompt(body, "balanced");
    // visualDnaFragment content — matte/soft-light world — should be present
    expect(positive.length).toBeGreaterThan(200);
    expect(positive.toLowerCase()).toMatch(/matte|soft|warm/);
  });

  it("changes presentation per style without changing identity", () => {
    const soft = buildCharacterAssemblyPrompt(body, "soft").positive;
    const bold = buildCharacterAssemblyPrompt(body, "bold").positive;
    expect(soft).not.toBe(bold);
    expect(soft).toContain(STYLE_PRESETS.soft.posture);
    expect(bold).toContain(STYLE_PRESETS.bold.posture);
    // both still refuse to touch identity
    expect(soft).toMatch(/do not change identity or body build/i);
    expect(bold).toMatch(/do not change identity or body build/i);
  });

  it("keeps the transparent, anatomy-clean, scene-free contract", () => {
    const { positive, negative } = buildCharacterAssemblyPrompt(body, "balanced");
    expect(positive).toMatch(/transparent background/i);
    expect(positive).toMatch(/five-finger hands/i);
    for (const banned of ["extra fingers", "room", "furniture", "background", "baked ground shadow"]) {
      expect(negative).toContain(banned);
    }
  });
});
