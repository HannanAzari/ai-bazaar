import { describe, it, expect, beforeEach } from "vitest";
import {
  adoptLegacyProfile,
  claimUsername,
  ensureNestProfile,
  getNestProfile,
  isUsernameAvailable,
  normalizeUsername,
  resolveByUsername,
  updateNestProfile,
  validateUsername,
} from "@/lib/nest-profile-store";

// M16 — the nest-identity profile: username ownership (unique, validated, immutable)
// plus display name / bio / socials. Pure localStorage.
describe("normalizeUsername", () => {
  it("lowercases; spaces/symbols → underscore (Phase 3 rules)", () => {
    expect(normalizeUsername("Hannan Azari!!")).toBe("hannan_azari");
    expect(normalizeUsername("Creator Loft")).toBe("creator_loft");
    expect(normalizeUsername("A")).toBe("a");
  });
});

describe("validateUsername", () => {
  it("rejects too-short and reserved handles, accepts good ones", () => {
    expect(validateUsername("ab")).toMatch(/at least/);
    expect(validateUsername("home")).toMatch(/reserved/);
    expect(validateUsername("profile")).toMatch(/reserved/);
    expect(validateUsername("gamer_room")).toBeNull();
  });
});

describe("claimUsername + uniqueness", () => {
  beforeEach(() => localStorage.clear());

  it("claims a handle and resolves it back", () => {
    const r = claimUsername("acct-1", "Hannan");
    expect(r.ok).toBe(true);
    expect(resolveByUsername("hannan")?.userId).toBe("acct-1");
    expect(getNestProfile("acct-1")?.username).toBe("hannan");
  });

  it("prevents a second account from taking the same handle", () => {
    claimUsername("acct-1", "hannan");
    expect(isUsernameAvailable("hannan", "acct-2")).toBe(false);
    expect(claimUsername("acct-2", "hannan").ok).toBe(false);
  });

  it("is immutable: the same account cannot change its handle", () => {
    expect(claimUsername("acct-1", "hannan").ok).toBe(true);
    const changed = claimUsername("acct-1", "hannan2");
    expect(changed.ok).toBe(false);
    if (!changed.ok) expect(changed.error).toMatch(/permanent/i);
    // Re-claiming the same handle is a harmless no-op.
    expect(claimUsername("acct-1", "hannan").ok).toBe(true);
  });
});

describe("ensureNestProfile", () => {
  beforeEach(() => localStorage.clear());

  it("creates a profile WITHOUT a username (claimed later), idempotently", () => {
    const p = ensureNestProfile("acct-1", "Hannan");
    expect(p.username).toBeUndefined();
    expect(p.displayName).toBe("Hannan");
    const again = ensureNestProfile("acct-1", "Someone Else");
    expect(again.displayName).toBe("Hannan"); // unchanged
  });
});

describe("updateNestProfile", () => {
  beforeEach(() => localStorage.clear());

  it("patches bio + socials without touching the username", () => {
    claimUsername("acct-1", "hannan");
    const p = updateNestProfile("acct-1", { bio: "Ceramics + tea", socials: { website: "hannan.dev" } });
    expect(p.bio).toBe("Ceramics + tea");
    expect(p.socials?.website).toBe("hannan.dev");
    expect(p.username).toBe("hannan");
  });
});

describe("adoptLegacyProfile (migration)", () => {
  beforeEach(() => localStorage.clear());

  it("moves the legacy stub username onto the account and frees the old row", () => {
    claimUsername("stub-1", "hannan"); // M15 stub identity held the handle
    updateNestProfile("stub-1", { bio: "old bio" });
    const merged = adoptLegacyProfile("acct-1", "stub-1");
    expect(merged?.username).toBe("hannan");
    expect(merged?.bio).toBe("old bio");
    expect(getNestProfile("stub-1")).toBeNull(); // old row removed
    expect(resolveByUsername("hannan")?.userId).toBe("acct-1");
  });
});
