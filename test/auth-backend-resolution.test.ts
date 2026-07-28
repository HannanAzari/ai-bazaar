import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── HOTFIX M23B.2 — an account must never silently go to localStorage ────────
//
// A founder created an account through the UI, was taken to onboarding, and the user did
// not exist in Supabase Authentication → Users. The request was never sent: the build had
// resolved to the local demo backend because `NEXT_PUBLIC_NEST_BACKEND` was not exactly
// "supabase" at BUILD time.
//
// `nestBackend()` reads `process.env` at call time, so each case re-imports the module
// with a fresh environment.

const ORIGINAL = { ...process.env };

/** Every case starts from a blank environment — otherwise state leaks between them. */
const AUTH_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_NEST_BACKEND",
] as const;

function applyEnv(env: Record<string, string | undefined>): void {
  vi.resetModules();
  for (const k of AUTH_ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) process.env[k] = v;
  }
}

async function backendWith(env: Record<string, string | undefined>): Promise<"local" | "supabase"> {
  applyEnv(env);
  const { nestBackend } = await import("@/lib/nest-repo");
  return nestBackend();
}

const SUPABASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://srrmkdsvldlyllsxyhtq.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
};

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_NEST_BACKEND;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

describe("nestBackend() — the regression that lost the founder's account", () => {
  it("uses Supabase when the project is configured and the flag is MISSING", async () => {
    // THE BUG: this used to return "local", so sign-up wrote to localStorage while the
    // UI reported success. A configured deployment can no longer demo-mode by omission.
    expect(await backendWith({ ...SUPABASE_ENV, NEXT_PUBLIC_NEST_BACKEND: undefined })).toBe("supabase");
  });

  it("uses Supabase when the flag is an unrecognised value (typo, stale value)", async () => {
    expect(await backendWith({ ...SUPABASE_ENV, NEXT_PUBLIC_NEST_BACKEND: "Supabase" })).toBe("supabase");
    expect(await backendWith({ ...SUPABASE_ENV, NEXT_PUBLIC_NEST_BACKEND: "" })).toBe("supabase");
    expect(await backendWith({ ...SUPABASE_ENV, NEXT_PUBLIC_NEST_BACKEND: "postgres" })).toBe("supabase");
  });

  it("still honours an EXPLICIT local override (offline dev / demo)", async () => {
    expect(await backendWith({ ...SUPABASE_ENV, NEXT_PUBLIC_NEST_BACKEND: "local" })).toBe("local");
  });

  it("still honours an explicit supabase flag", async () => {
    expect(await backendWith({ ...SUPABASE_ENV, NEXT_PUBLIC_NEST_BACKEND: "supabase" })).toBe("supabase");
  });

  it("falls back to local ONLY when Supabase is genuinely unconfigured", async () => {
    expect(await backendWith({ NEXT_PUBLIC_NEST_BACKEND: undefined })).toBe("local");
  });

  it("treats a half-configured environment as unconfigured", async () => {
    // A URL with no anon key cannot authenticate; pretending otherwise would produce a
    // different silent failure.
    expect(await backendWith({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE_ENV.NEXT_PUBLIC_SUPABASE_URL })).toBe("local");
    expect(await backendWith({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" })).toBe("local");
  });
});

describe("project diagnostics", () => {
  async function diag(env: Record<string, string | undefined>) {
    applyEnv(env);
    const info = await import("@/lib/supabase/project-info");
    const { nestBackend } = await import("@/lib/nest-repo");
    return { info, d: info.authDiagnostics(nestBackend()) };
  }

  it("names the project a build will authenticate against", async () => {
    const { d } = await diag(SUPABASE_ENV);
    expect(d.projectRef).toBe("srrmkdsvldlyllsxyhtq");
    expect(d.host).toBe("srrmkdsvldlyllsxyhtq.supabase.co");
    expect(d.resolvedBackend).toBe("supabase");
  });

  it("reports configured vs resolved separately, so a mismatch is visible", async () => {
    const { d } = await diag({ ...SUPABASE_ENV, NEXT_PUBLIC_NEST_BACKEND: "local" });
    expect(d.configuredBackend).toBe("local");
    expect(d.resolvedBackend).toBe("local");
    expect(d.hasUrl).toBe(true); // configured but not used — the dangerous combination
  });

  it("describes the misconfigured case in words a human can act on", async () => {
    const { info, d } = await diag({ ...SUPABASE_ENV, NEXT_PUBLIC_NEST_BACKEND: "local" });
    const text = info.describeAuthTarget(d);
    expect(text).toContain("LOCAL demo backend");
    expect(text).toContain("srrmkdsvldlyllsxyhtq");
    expect(text).toContain("will NOT reach Supabase");
  });

  it("describes the unconfigured case as a BUILD-time env problem", async () => {
    const { info, d } = await diag({ NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined });
    const text = info.describeAuthTarget(d);
    expect(text).toContain("BUILD time");
    expect(d.projectRef).toBeNull();
  });

  it("names the project plainly when everything is correct", async () => {
    const { info, d } = await diag(SUPABASE_ENV);
    expect(info.describeAuthTarget(d)).toBe("Supabase project srrmkdsvldlyllsxyhtq (srrmkdsvldlyllsxyhtq.supabase.co)");
  });
});

// ── The account layer refuses BEFORE writing anything ────────────────────────
//
// Browser verification caught a real gap here: the page-level guard stopped the user
// continuing, but `localSignUp` had ALREADY written an account and set a session. Half a
// signed-in state for an account that exists nowhere is worse than a clean failure, so
// the refusal moved down into lib/nest-account.ts — ahead of any write.
describe("misconfigured deployment refuses to create a local account", () => {
  async function accountApi(env: Record<string, string | undefined>) {
    applyEnv(env);
    return import("@/lib/nest-account");
  }

  const MISCONFIGURED = { ...SUPABASE_ENV, NEXT_PUBLIC_NEST_BACKEND: "local" };

  it("signUp fails instead of writing a localStorage account", async () => {
    const { signUp } = await accountApi(MISCONFIGURED);
    window.localStorage.clear();

    const r = await signUp("ada@example.com", "supersecret");

    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ error: expect.stringContaining("misconfigured") });
    // The point of the fix: nothing was persisted and no session was granted.
    expect(window.localStorage.getItem("nestudio-accounts")).toBeNull();
    expect(window.localStorage.getItem("nestudio-account-session")).toBeNull();
  });

  it("signIn fails the same way, so a stale local account can't be used either", async () => {
    const { signIn } = await accountApi(MISCONFIGURED);
    window.localStorage.clear();

    const r = await signIn("ada@example.com", "supersecret");

    expect(r.ok).toBe(false);
    expect(window.localStorage.getItem("nestudio-account-session")).toBeNull();
  });

  it("a genuinely unconfigured build still allows local demo accounts", async () => {
    // No Supabase URL at all ⇒ this is a real demo build, not a broken one. The auth
    // screens carry a visible demo banner; the flow itself must keep working.
    const { signUp } = await accountApi({ NEXT_PUBLIC_NEST_BACKEND: "local" });
    window.localStorage.clear();

    const r = await signUp("ada@example.com", "supersecret");

    expect(r.ok).toBe(true);
    expect(r).toMatchObject({ backend: "local" });
    expect(window.localStorage.getItem("nestudio-accounts")).not.toBeNull();
  });
});
