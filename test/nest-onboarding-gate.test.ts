import { describe, expect, it } from "vitest";
import { nextOnboardingStep, onboardingComplete, type CreatorProfile } from "@/lib/nest/supabase-profile-repo";
import { DEFAULT_HOUSE_STYLE_KEY, HOUSE_STYLE_KEYS, houseStyleOptions, isHouseStyleKey, styleByKey } from "@/lib/nest-house";

// M23B §1 — who is sent through onboarding, and where they resume.
describe("onboarding gate", () => {
  const complete: CreatorProfile = {
    id: "u1",
    displayName: "Ada",
    username: "ada",
    houseStyle: "cottage",
  };

  it("treats a fully configured creator as done", () => {
    expect(onboardingComplete(complete)).toBe(true);
    expect(nextOnboardingStep(complete)).toBeNull();
  });

  it("sends a creator with no profile row to step 1", () => {
    expect(nextOnboardingStep(null)).toBe("identity");
    expect(onboardingComplete(null)).toBe(false);
  });

  it("resumes at the HOUSE step when only the house is missing", () => {
    const { houseStyle: _omitted, ...noHouse } = complete;
    expect(nextOnboardingStep(noHouse)).toBe("house");
    expect(onboardingComplete(noHouse)).toBe(false);
  });

  it("returns to the IDENTITY step when the username is missing", () => {
    const { username: _omitted, ...noUsername } = complete;
    expect(nextOnboardingStep(noUsername)).toBe("identity");
  });

  it("returns to the IDENTITY step when the display name is blank", () => {
    expect(nextOnboardingStep({ ...complete, displayName: "   " })).toBe("identity");
  });
});

// §1 step 2 + §5 — the house catalogue the carousel offers, and how a stored key resolves.
describe("house styles", () => {
  it("offers every catalogued style, in display order, with a label and a blurb", () => {
    const options = houseStyleOptions();
    expect(options.map((o) => o.key)).toEqual([...HOUSE_STYLE_KEYS]);
    for (const o of options) {
      expect(o.style.label.length).toBeGreaterThan(0);
      expect(o.blurb.length).toBeGreaterThan(0);
    }
  });

  it("validates stored keys", () => {
    expect(isHouseStyleKey("cottage")).toBe(true);
    expect(isHouseStyleKey("mansion")).toBe(false);
    expect(isHouseStyleKey(undefined)).toBe(false);
    expect(isHouseStyleKey(null)).toBe(false);
  });

  it("falls back rather than rendering an undefined palette for an unknown key", () => {
    // A key written by an older build must never blank out someone's house.
    expect(styleByKey("mansion")).toEqual(styleByKey(DEFAULT_HOUSE_STYLE_KEY));
    expect(styleByKey(undefined).key).toBe(DEFAULT_HOUSE_STYLE_KEY);
  });

  it("gives each style a distinct palette, so the carousel is a real choice", () => {
    const walls = new Set(houseStyleOptions().map((o) => o.style.wall));
    expect(walls.size).toBe(HOUSE_STYLE_KEYS.length);
  });
});
