import { describe, it, expect, beforeEach } from "vitest";
import {
  getCurrentAccount,
  signIn,
  signOut,
  signUp,
  validateEmail,
  validatePassword,
} from "@/lib/nest-account";

// M16 — the local (demo) Nest account backend: email sign-up / sign-in / sign-out,
// session persistence + restoration. NEST_BACKEND is unset in tests → local backend.
describe("account validation", () => {
  it("checks email + password", () => {
    expect(validateEmail("nope")).toMatch(/valid email/);
    expect(validateEmail("a@b.co")).toBeNull();
    expect(validatePassword("short")).toMatch(/8 characters/);
    expect(validatePassword("longenough")).toBeNull();
  });
});

describe("sign up / in / out + session restore", () => {
  beforeEach(() => localStorage.clear());

  it("signs up, persists a session, and restores it", async () => {
    const r = await signUp("hannan@example.com", "supersecret");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.account.email).toBe("hannan@example.com");
    // Session persists → a fresh read restores the same account.
    const restored = await getCurrentAccount();
    expect(restored?.email).toBe("hannan@example.com");
  });

  it("rejects duplicate email on sign-up", async () => {
    await signUp("dup@example.com", "supersecret");
    const again = await signUp("dup@example.com", "supersecret");
    expect(again.ok).toBe(false);
  });

  it("rejects a wrong password on sign-in and accepts the right one", async () => {
    await signUp("login@example.com", "correcthorse");
    await signOut();
    expect(await getCurrentAccount()).toBeNull();
    const bad = await signIn("login@example.com", "wrongpass1");
    expect(bad.ok).toBe(false);
    const good = await signIn("login@example.com", "correcthorse");
    expect(good.ok).toBe(true);
    expect((await getCurrentAccount())?.email).toBe("login@example.com");
  });

  it("sign-out clears the session", async () => {
    await signUp("bye@example.com", "supersecret");
    await signOut();
    expect(await getCurrentAccount()).toBeNull();
  });

  it("keeps two accounts distinct (multi-account)", async () => {
    const a = await signUp("a@example.com", "passworda");
    await signOut();
    const b = await signUp("b@example.com", "passwordb");
    expect(a.ok && b.ok && a.account.id !== b.account.id).toBe(true);
  });
});
