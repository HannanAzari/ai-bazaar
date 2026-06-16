import { describe, it, expect } from "vitest";
import {
  LIMITS,
  clampText,
  isValidAddress,
  isValidEmail,
  isValidPassword,
  isValidSocialUrl,
  validateHandle,
  withinLimit,
} from "@/lib/validation";

describe("clampText / withinLimit", () => {
  it("hard-caps to the field limit", () => {
    const long = "x".repeat(500);
    expect(clampText(long, "objectLabel").length).toBe(LIMITS.objectLabel);
    expect(clampText("hi", "roomName")).toBe("hi");
    expect(clampText(undefined as unknown as string, "bio")).toBe("");
  });
  it("checks length within a limit (after trim)", () => {
    expect(withinLimit("  short  ", "craft")).toBe(true);
    expect(withinLimit("y".repeat(LIMITS.craft + 1), "craft")).toBe(false);
  });
});

describe("validateHandle", () => {
  it("normalizes to a lowercase dashed handle", () => {
    expect(validateHandle("Jane Doe")).toEqual({ ok: true, value: "jane-doe" });
    expect(validateHandle("  Cosy_Kettle!! ").value).toBe("cosy-kettle");
  });
  it("rejects too-short handles", () => {
    const r = validateHandle("ab");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/at least 3/i);
  });
  it("caps + flags too-long handles", () => {
    const r = validateHandle("a".repeat(40));
    expect(r.ok).toBe(false);
    expect(r.value.length).toBe(LIMITS.handle);
  });
});

describe("email / password", () => {
  it("validates email shape", () => {
    expect(isValidEmail("jane@example.com")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
  it("enforces a 6-char password floor", () => {
    expect(isValidPassword("123456")).toBe(true);
    expect(isValidPassword("12345")).toBe(false);
  });
});

describe("address", () => {
  it("matches the three-word village address format", () => {
    expect(isValidAddress("moon.tiny.bell")).toBe(true);
    expect(isValidAddress("moon.tiny")).toBe(false);
    expect(isValidAddress("Moon.Tiny.Bell")).toBe(false); // uppercase rejected (DB CHECK)
    expect(isValidAddress("moon.tiny.bell1")).toBe(false); // digits rejected
  });
});

describe("social URL", () => {
  it("accepts http(s) (or bare) within the length cap", () => {
    expect(isValidSocialUrl("instagram.com/jane")).toBe(true);
    expect(isValidSocialUrl("https://example.com")).toBe(true);
  });
  it("rejects empty, over-long, or non-web values", () => {
    expect(isValidSocialUrl("")).toBe(false);
    expect(isValidSocialUrl("x".repeat(LIMITS.socialUrl + 1))).toBe(false);
    expect(isValidSocialUrl("javascript:alert(1)")).toBe(false);
  });
});
