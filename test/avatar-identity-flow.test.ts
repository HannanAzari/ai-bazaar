import { describe, expect, it } from "vitest";
import {
  AVATAR_BUILDS,
  DEFAULT_AVATAR_BODY,
  PROPORTION_POLICY,
  STAGE2_REFERENCE_ROLES,
  assembleReferences,
  composeAssembly,
  freezeIdentity,
  resolveAvatarBody,
  IdentityFreezeError,
  type AvatarBody,
  type AvatarIdentity,
} from "@/lib/avatar-factory/identity";

const candidate = (): AvatarIdentity => ({
  version: "avatar-identity-v1",
  anchorImageUrl: "data:image/png;base64,APPROVED",
  faceShape: "oval", eyeShape: "almond", eyebrowShape: "soft", nose: "straight", mouth: "medium", smile: "gentle",
  hairstyle: "short", hairColour: "dark", facialHair: "none", glasses: "none", ears: "visible", neck: "average",
  skinTone: "warm mid", distinguishingFeatures: [], expression: "calm", frozen: false,
});
const approval = () => ({ approvedBy: "founder" as const, approvedByUserId: "user-123", at: "2026-07-24T00:00:00.000Z" });
const ORIGINAL = "data:image/png;base64,ORIGINAL";
const APPROVED = "data:image/png;base64,APPROVED";

describe("1 · Stage 2 requires BOTH references", () => {
  it("throws without the original photo", () => {
    expect(() => assembleReferences(null, APPROVED)).toThrow(/ORIGINAL PHOTO/i);
  });
  it("throws without the approved identity", () => {
    expect(() => assembleReferences(ORIGINAL, null)).toThrow(/APPROVED IDENTITY/i);
  });
  it("returns both, original first (highest identity priority)", () => {
    expect(assembleReferences(ORIGINAL, APPROVED)).toEqual([ORIGINAL, APPROVED]);
    expect(STAGE2_REFERENCE_ROLES).toEqual(["original-photo", "approved-identity"]);
  });
  it("composeAssembly refuses to build with a missing reference", () => {
    const f = freezeIdentity(candidate(), approval());
    expect(() => composeAssembly({ identity: f, body: DEFAULT_AVATAR_BODY, style: "balanced", originalPhotoUrl: null, approvedIdentityUrl: APPROVED })).toThrow();
  });
});

describe("2 · An identity cannot be frozen without approval", () => {
  it("throws when approval is missing", () => {
    expect(() => freezeIdentity(candidate(), null)).toThrow(IdentityFreezeError);
    expect(() => freezeIdentity(candidate(), undefined)).toThrow(/approval/i);
  });
  it("throws when there is no owner on the approval", () => {
    expect(() => freezeIdentity(candidate(), { approvedBy: "founder", approvedByUserId: "", at: "t" })).toThrow(/approval/i);
  });
  it("freezes with a valid owner-scoped approval", () => {
    const f = freezeIdentity(candidate(), approval());
    expect(f.frozen).toBe(true);
    expect(f.approval.approvedByUserId).toBe("user-123");
  });
});

describe("3 · Frozen identity cannot be silently overwritten", () => {
  it("refuses to re-freeze over an already-frozen identity", () => {
    const first = freezeIdentity(candidate(), approval());
    expect(() => freezeIdentity(candidate(), approval(), { existing: first })).toThrow(/already frozen/i);
  });
  it("allows freezing when there is no existing frozen identity", () => {
    expect(() => freezeIdentity(candidate(), approval(), { existing: null })).not.toThrow();
    expect(() => freezeIdentity(candidate(), approval(), { existing: { ...candidate(), frozen: false } })).not.toThrow();
  });
});

describe("4 · Style presets do not modify identity fields", () => {
  it("returns the identity object untouched across every preset", () => {
    const f = freezeIdentity(candidate(), approval());
    const soft = composeAssembly({ identity: f, body: DEFAULT_AVATAR_BODY, style: "soft", originalPhotoUrl: ORIGINAL, approvedIdentityUrl: APPROVED });
    const bold = composeAssembly({ identity: f, body: DEFAULT_AVATAR_BODY, style: "bold", originalPhotoUrl: ORIGINAL, approvedIdentityUrl: APPROVED });
    expect(soft.identity).toBe(f);
    expect(bold.identity).toBe(f);
    expect(soft.identity).toEqual(bold.identity);
  });
});

describe("5 · Style presets do not modify body build", () => {
  it("returns the same body object across every preset", () => {
    const f = freezeIdentity(candidate(), approval());
    const body: AvatarBody = resolveAvatarBody("athletic");
    const soft = composeAssembly({ identity: f, body, style: "soft", originalPhotoUrl: ORIGINAL, approvedIdentityUrl: APPROVED });
    const bold = composeAssembly({ identity: f, body, style: "bold", originalPhotoUrl: ORIGINAL, approvedIdentityUrl: APPROVED });
    expect(soft.body).toEqual(bold.body);
    expect(soft.body.build).toBe("athletic");
    // presets differ only in presentation, not build
    expect(soft.positive).not.toBe(bold.positive);
    expect(soft.positive).toContain("athletic");
    expect(bold.positive).toContain("athletic");
  });
});

describe("6 · A headshot never triggers automatic body-build inference", () => {
  it("policy forbids inference from a headshot", () => {
    expect(PROPORTION_POLICY.inferBuildFromHeadshot).toBe(false);
  });
  it("resolveAvatarBody takes an EXPLICIT build and reads no image", () => {
    // Signature is (build, opts?) — no image parameter, so build is always a caller choice
    // and can never be derived from photo pixels.
    expect(resolveAvatarBody.length).toBeLessThanOrEqual(2);
    for (const b of AVATAR_BUILDS) expect(resolveAvatarBody(b).build).toBe(b);
    // opts only carries a full-body-reference flag, never an image to read a build from.
    expect(resolveAvatarBody("average", { fullBodyReference: true }).build).toBe("average");
  });
});

describe("7 · Stage 2 uses adult, non-rounded default proportions", () => {
  it("defaults to adult proportions (long legs, no childlike/wide-torso)", () => {
    expect(PROPORTION_POLICY.childlikeByDefault).toBe(false);
    expect(PROPORTION_POLICY.autoWideTorso).toBe(false);
    expect(PROPORTION_POLICY.legsRelativeToTorso).toBe("long");
    expect(resolveAvatarBody("average").legLength).toBe("long");
  });
  it("the assembly prompt explicitly bans rounding / enlarging / childlike proportions", () => {
    const f = freezeIdentity(candidate(), approval());
    const { negative, positive } = composeAssembly({ identity: f, body: resolveAvatarBody("average"), style: "balanced", originalPhotoUrl: ORIGINAL, approvedIdentityUrl: APPROVED });
    for (const banned of ["rounded cheeks", "enlarged head", "childlike proportions", "wide torso", "thick neck"]) {
      expect(negative).toContain(banned);
    }
    expect(positive).toMatch(/do not broaden the face/i);
    expect(positive).toMatch(/do not enlarge the head/i);
  });
});

describe("8 · Identity candidates remain private + owner-scoped", () => {
  it("a frozen identity always carries its owner", () => {
    const f = freezeIdentity(candidate(), approval());
    expect(f.approval.approvedByUserId).toBeTruthy();
  });
  it("composeAssembly never emits a public URL — only the provided private refs", () => {
    const f = freezeIdentity(candidate(), approval());
    const req = composeAssembly({ identity: f, body: DEFAULT_AVATAR_BODY, style: "balanced", originalPhotoUrl: ORIGINAL, approvedIdentityUrl: APPROVED });
    expect(req.references).toEqual([ORIGINAL, APPROVED]);
    expect(req.references.some((r) => /^https?:\/\//.test(r))).toBe(false);
  });
});

describe("9 · Retrying Stage 2 reuses the approved identity (no re-freeze)", () => {
  it("two assemblies from the SAME frozen identity share it and never re-freeze", () => {
    const f = freezeIdentity(candidate(), approval());
    const a = composeAssembly({ identity: f, body: resolveAvatarBody("slim"), style: "balanced", originalPhotoUrl: ORIGINAL, approvedIdentityUrl: APPROVED });
    const b = composeAssembly({ identity: f, body: resolveAvatarBody("broad"), style: "bold", originalPhotoUrl: ORIGINAL, approvedIdentityUrl: APPROVED });
    // same identity object reused across retries with different bodies/styles
    expect(a.identity).toBe(f);
    expect(b.identity).toBe(f);
    expect(a.references[1]).toBe(b.references[1]); // approved identity reference identical
    // a retry must not require re-freezing — re-freezing the SAME frozen identity is blocked
    expect(() => freezeIdentity(candidate(), approval(), { existing: f })).toThrow(/already frozen/i);
  });
});

describe("10 · One-shot fallback remains intact", () => {
  it("the shared one-shot prompt builder is unchanged and still works standalone", async () => {
    const { buildAvatarPrompt } = await import("@/lib/avatar-factory/avatar-dna");
    const { estimateAvatarCost } = await import("@/lib/avatar-factory/translator");
    const spec = {
      displayName: "T", styleIntensity: "balanced" as const, outfitCategory: "casual", clothingPalette: "warm",
      hair: "short", accessories: [], expression: "neutral", bodyProportionFamily: "standard",
      canonicalPose: "idle-standing" as const, transparency: true as const, intendedUses: ["profile" as const],
      privacyScope: "private-user" as const, estimatedCostUsd: estimateAvatarCost(), moderation: { ok: true, note: "" },
      generationSubject: "a person standing",
    };
    const { positive, negative } = buildAvatarPrompt(spec);
    expect(positive.length).toBeGreaterThan(50);
    expect(negative.length).toBeGreaterThan(10);
  });
});
