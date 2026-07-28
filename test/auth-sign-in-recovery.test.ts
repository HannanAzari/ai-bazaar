import { describe, expect, it, vi } from "vitest";
import {
  postSignInRoute,
  safeReturnTo,
  shouldLeaveOnboarding,
  shouldRedirectToOnboarding,
  type BootstrapState,
} from "@/lib/auth/post-sign-in-route";
import { BOOTSTRAP_TIMEOUT_MS, isTimeoutError, TimeoutError, withTimeout } from "@/lib/with-timeout";
import type { CreatorProfile } from "@/lib/nest/supabase-profile-repo";

// ── HOTFIX M23B.1 — sign-in must always recover ──────────────────────────────
//
// The founder's freeze was a promise that never settled, plus a /profile ↔ /onboarding
// redirect loop that kept re-querying the profile. These tests pin down the two pieces of
// logic that make both impossible: the routing decision, and the timeout backstop.

const complete: CreatorProfile = { id: "u1", displayName: "Ada", username: "ada", houseStyle: "cottage" };
const noHouse: CreatorProfile = { id: "u1", displayName: "Ada", username: "ada" };
const noUsername: CreatorProfile = { id: "u1", displayName: "Ada" };

const ready = (profile: CreatorProfile | null): BootstrapState => ({ status: "ready", profile });
const loading: BootstrapState = { status: "loading" };
const failed: BootstrapState = { status: "error", message: "column profiles.house_style does not exist" };

describe("1. authenticated with a complete profile", () => {
  it("routes to the creator's Profile", () => {
    expect(postSignInRoute(ready(complete))).toEqual({ kind: "navigate", to: "/profile" });
  });

  it("honours a safe return URL instead", () => {
    expect(postSignInRoute(ready(complete), "/nest/cosy-loft-ab12")).toEqual({
      kind: "navigate",
      to: "/nest/cosy-loft-ab12",
    });
  });

  it("never sends a complete profile back through onboarding", () => {
    expect(shouldRedirectToOnboarding(ready(complete))).toBe(false);
    expect(shouldLeaveOnboarding(ready(complete))).toBe(true);
  });
});

describe("2. authenticated with NO profile row", () => {
  it("routes into onboarding rather than treating it as fatal", () => {
    expect(postSignInRoute(ready(null))).toEqual({ kind: "navigate", to: "/onboarding" });
  });

  it("carries the return URL through onboarding so the interaction resumes after", () => {
    expect(postSignInRoute(ready(null), "/nest/cosy-loft-ab12")).toEqual({
      kind: "navigate",
      to: "/onboarding?next=%2Fnest%2Fcosy-loft-ab12",
    });
  });
});

describe("3. authenticated with incomplete onboarding", () => {
  it("routes to onboarding when the username is missing", () => {
    expect(postSignInRoute(ready(noUsername))).toEqual({ kind: "navigate", to: "/onboarding" });
  });

  it("routes to onboarding when only the house is missing", () => {
    expect(postSignInRoute(ready(noHouse))).toEqual({ kind: "navigate", to: "/onboarding" });
    expect(shouldRedirectToOnboarding(ready(noHouse))).toBe(true);
  });
});

describe("4/5. authentication succeeded but the profile query failed", () => {
  it("does NOT navigate — it reports a recoverable error", () => {
    const decision = postSignInRoute(failed);
    expect(decision.kind).toBe("error");
    expect(decision).toMatchObject({ message: expect.stringContaining("house_style") });
  });

  it("is never confused with a missing profile (which would mean onboarding)", () => {
    expect(shouldRedirectToOnboarding(failed)).toBe(false);
    expect(shouldLeaveOnboarding(failed)).toBe(false);
  });

  it("BOTH screens stay put on error — this is what broke the redirect loop", () => {
    // The loop needed /profile and /onboarding to disagree. On a failed bootstrap they
    // now agree: neither redirects.
    expect(shouldRedirectToOnboarding(failed)).toBe(false);
    expect(shouldLeaveOnboarding(failed)).toBe(false);
  });
});

describe("loading is decided by nobody", () => {
  it("waits instead of routing", () => {
    expect(postSignInRoute(loading)).toEqual({ kind: "wait" });
  });

  it("neither screen redirects while the profile is still loading", () => {
    // /profile used to redirect here because a null profile and a not-yet-loaded profile
    // were indistinguishable — the other half of the loop.
    expect(shouldRedirectToOnboarding(loading)).toBe(false);
    expect(shouldLeaveOnboarding(loading)).toBe(false);
  });
});

describe("return URLs are validated", () => {
  it("accepts a same-origin path", () => {
    expect(safeReturnTo("/explore")).toBe("/explore");
  });

  it("rejects absolute and protocol-relative URLs (open-redirect)", () => {
    expect(safeReturnTo("https://evil.example.com")).toBeNull();
    expect(safeReturnTo("//evil.example.com")).toBeNull();
  });

  it("rejects bouncing straight back to an auth screen", () => {
    expect(safeReturnTo("/auth/login")).toBeNull();
  });

  it("handles absent values", () => {
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo("")).toBeNull();
  });
});

describe("8. bootstrap timeout", () => {
  it("rejects when the promise never settles, so the caller's finally runs", async () => {
    vi.useFakeTimers();
    const never = new Promise<string>(() => {}); // the exact shape of the freeze
    const guarded = withTimeout(never, 5_000, "Loading your profile");
    const assertion = expect(guarded).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    vi.useRealTimers();
  });

  it("identifies its own error so the UI can word it correctly", async () => {
    vi.useFakeTimers();
    const guarded = withTimeout(new Promise<string>(() => {}), 1_000, "Loading your profile");
    const assertion = guarded.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1_000);
    const err = await assertion;
    expect(isTimeoutError(err)).toBe(true);
    expect((err as Error).message).toContain("Loading your profile");
    vi.useRealTimers();
  });

  it("passes a value straight through when it settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1_000, "op")).resolves.toBe("ok");
  });

  it("propagates a real rejection rather than masking it as a timeout", async () => {
    const boom = new Error("relation \"public.nests\" does not exist");
    await expect(withTimeout(Promise.reject(boom), 1_000, "op")).rejects.toThrow(boom);
  });

  it("uses a bounded default so nothing can spin forever", () => {
    expect(BOOTSTRAP_TIMEOUT_MS).toBeGreaterThan(0);
    expect(BOOTSTRAP_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
