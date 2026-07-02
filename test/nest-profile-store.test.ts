import { describe, it, expect, beforeEach } from "vitest";
import {
  claimUsername,
  ensureNestProfile,
  getNestProfile,
  isUsernameAvailable,
  normalizeUsername,
  resolveByUsername,
  updateNestProfile,
  validateUsername,
} from "@/lib/nest-profile-store";

// M15 — the nest-identity spine (username ownership + profile). Pure localStorage.
describe("normalizeUsername", () => {
  it("lowercases and strips illegal characters", () => {
    expect(normalizeUsername("Hannan Azari!!")).toBe("hannan-azari");
    expect(normalizeUsername("Cozy Kettle")).toBe("cozy-kettle");
    expect(normalizeUsername("A")).toBe("a");
  });
});

describe("validateUsername", () => {
  it("rejects too-short and reserved handles, accepts good ones", () => {
    expect(validateUsername("ab")).toMatch(/at least/);
    expect(validateUsername("home")).toMatch(/reserved/);
    expect(validateUsername("hannan")).toBeNull();
  });
});

describe("claimUsername + uniqueness", () => {
  beforeEach(() => localStorage.clear());

  it("claims a handle and resolves it back", () => {
    const r = claimUsername("user-1", "Hannan");
    expect(r.ok).toBe(true);
    expect(resolveByUsername("hannan")?.userId).toBe("user-1");
    expect(getNestProfile("user-1")?.username).toBe("hannan");
  });

  it("prevents a second user from taking the same handle", () => {
    claimUsername("user-1", "hannan");
    expect(isUsernameAvailable("hannan", "user-2")).toBe(false);
    const r = claimUsername("user-2", "hannan");
    expect(r.ok).toBe(false);
  });

  it("lets the same user re-claim their own handle", () => {
    claimUsername("user-1", "hannan");
    expect(isUsernameAvailable("hannan", "user-1")).toBe(true);
    expect(claimUsername("user-1", "hannan").ok).toBe(true);
  });
});

describe("ensureNestProfile", () => {
  beforeEach(() => localStorage.clear());

  it("is idempotent and derives a free username", () => {
    const a = ensureNestProfile("user-1", "Hannan");
    expect(a.username).toBe("hannan");
    const again = ensureNestProfile("user-1", "someone-else");
    expect(again.username).toBe("hannan"); // unchanged
  });

  it("pads a too-short fallback to a legal handle", () => {
    const p = ensureNestProfile("user-2", "ab");
    expect(p.username.length).toBeGreaterThanOrEqual(3);
  });
});

describe("updateNestProfile", () => {
  beforeEach(() => localStorage.clear());

  it("patches bio without touching the username", () => {
    claimUsername("user-1", "hannan");
    const p = updateNestProfile("user-1", { bio: "Ceramics + tea" });
    expect(p.bio).toBe("Ceramics + tea");
    expect(p.username).toBe("hannan");
  });
});
