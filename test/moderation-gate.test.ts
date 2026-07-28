import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canViewModeration } from "@/lib/auth/moderation-access";
import type { ServerAuth } from "@/lib/auth/server-session";

// Focused access-control tests for the /moderation gate. It reuses the existing role-based
// founder mechanism (getServerUser + isFounder allowlist) — no founder token, no new layer.
// Three required cases: unauthenticated · authenticated non-founder · founder.

const FOUNDER_EMAIL = "founder@nestudio.app";
const FOUNDER_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.stubEnv("FOUNDER_EMAILS", FOUNDER_EMAIL);
  vi.stubEnv("FOUNDER_USER_IDS", FOUNDER_ID);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/moderation access control", () => {
  it("DENIES an unauthenticated visitor (no session)", () => {
    expect(canViewModeration({ status: "no_session" } as ServerAuth)).toBe(false);
  });

  it("DENIES when Supabase is unconfigured (fail closed)", () => {
    expect(canViewModeration({ status: "unconfigured" } as ServerAuth)).toBe(false);
  });

  it("DENIES an authenticated NON-founder", () => {
    const auth: ServerAuth = { user: { id: "11111111-2222-3333-4444-555555555555", email: "regular@user.com", isAnonymous: false } };
    expect(canViewModeration(auth)).toBe(false);
  });

  it("DENIES an anonymous (guest) session", () => {
    const auth: ServerAuth = { user: { id: "guest-1", email: null, isAnonymous: true } };
    expect(canViewModeration(auth)).toBe(false);
  });

  it("ALLOWS a founder by email allowlist", () => {
    const auth: ServerAuth = { user: { id: "any-id", email: FOUNDER_EMAIL, isAnonymous: false } };
    expect(canViewModeration(auth)).toBe(true);
  });

  it("ALLOWS a founder by user-id allowlist", () => {
    const auth: ServerAuth = { user: { id: FOUNDER_ID, email: "someone-else@x.com", isAnonymous: false } };
    expect(canViewModeration(auth)).toBe(true);
  });
});
