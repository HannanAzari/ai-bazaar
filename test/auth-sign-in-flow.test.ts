import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSignInFlow, type SignInDeps } from "@/lib/auth/sign-in-flow";
import type { BootstrapState } from "@/lib/auth/post-sign-in-route";

// ── HOTFIX M23B.1 — the sign-in flow can never freeze ────────────────────────
//
// The founder's bug: the button stuck on "Signing in…" forever. Every test here asserts
// the same invariant from a different failure mode — `onBusy(false)` is always emitted.

const COMPLETE = { id: "u1", displayName: "Ada", username: "ada", houseStyle: "cottage" };
const ready = (profile: unknown): BootstrapState => ({ status: "ready", profile } as BootstrapState);

let busy: boolean[];
let navigate: ReturnType<typeof vi.fn>;
let log: ReturnType<typeof vi.fn>;

function deps(signIn: SignInDeps["signIn"], returnTo?: string | null): SignInDeps {
  return { signIn, navigate, onBusy: (b) => busy.push(b), returnTo, log };
}

/** The invariant that this whole hotfix exists to guarantee. */
function expectLoadingAlwaysReset() {
  expect(busy[0]).toBe(true);
  expect(busy[busy.length - 1]).toBe(false);
  expect(busy.filter((b) => b === false).length).toBeGreaterThan(0);
}

beforeEach(() => {
  busy = [];
  navigate = vi.fn();
  log = vi.fn();
});

describe("1. successful authentication with a complete profile", () => {
  it("navigates to the Profile and resets loading", async () => {
    const flow = createSignInFlow();
    const r = await flow.submit("a@b.c", "pw", deps(async () => ({ ok: true, bootstrap: ready(COMPLETE) })));
    expect(r).toEqual({ kind: "navigated", to: "/profile" });
    expect(navigate).toHaveBeenCalledWith("/profile");
    expectLoadingAlwaysReset();
  });

  it("honours a safe ?next= (sign-in triggered by Like/Comment/Follow)", async () => {
    const flow = createSignInFlow();
    const r = await flow.submit("a@b.c", "pw", deps(async () => ({ ok: true, bootstrap: ready(COMPLETE) }), "/nest/cosy-ab12"));
    expect(r).toEqual({ kind: "navigated", to: "/nest/cosy-ab12" });
  });

  it("ignores an unsafe ?next= rather than following it", async () => {
    const flow = createSignInFlow();
    const r = await flow.submit("a@b.c", "pw", deps(async () => ({ ok: true, bootstrap: ready(COMPLETE) }), "//evil.example.com"));
    expect(r).toEqual({ kind: "navigated", to: "/profile" });
  });
});

describe("2. successful authentication with NO profile", () => {
  it("routes into onboarding instead of erroring", async () => {
    const flow = createSignInFlow();
    const r = await flow.submit("a@b.c", "pw", deps(async () => ({ ok: true, bootstrap: ready(null) })));
    expect(r).toEqual({ kind: "navigated", to: "/onboarding" });
    expectLoadingAlwaysReset();
  });
});

describe("3. successful authentication with incomplete onboarding", () => {
  it("routes to onboarding when the house is missing", async () => {
    const flow = createSignInFlow();
    const partial = { id: "u1", displayName: "Ada", username: "ada" };
    const r = await flow.submit("a@b.c", "pw", deps(async () => ({ ok: true, bootstrap: ready(partial) })));
    expect(r).toEqual({ kind: "navigated", to: "/onboarding" });
  });
});

describe("4/5. authentication succeeded, profile query failed (missing table or column)", () => {
  const missingColumn: BootstrapState = {
    status: "error",
    message: 'column profiles.house_style does not exist',
  };

  it("reports a BOOTSTRAP error, never an auth error", async () => {
    const flow = createSignInFlow();
    const r = await flow.submit("a@b.c", "pw", deps(async () => ({ ok: true, bootstrap: missingColumn })));
    expect(r.kind).toBe("bootstrap-error");
    expect(r).toMatchObject({ message: expect.stringContaining("house_style") });
    // Crucially: we did NOT navigate, and did NOT claim the password was wrong.
    expect(navigate).not.toHaveBeenCalled();
    expectLoadingAlwaysReset();
  });

  it("also covers a missing table", async () => {
    const flow = createSignInFlow();
    const missingTable: BootstrapState = { status: "error", message: "Could not find the table 'public.nests'" };
    const r = await flow.submit("a@b.c", "pw", deps(async () => ({ ok: true, bootstrap: missingTable })));
    expect(r.kind).toBe("bootstrap-error");
    expectLoadingAlwaysReset();
  });
});

describe("6. incorrect password", () => {
  it("reports an auth error and resets loading", async () => {
    const flow = createSignInFlow();
    const r = await flow.submit("a@b.c", "wrong", deps(async () => ({ ok: false, error: "Wrong email or password." })));
    expect(r).toEqual({ kind: "auth-error", message: "Wrong email or password." });
    expect(navigate).not.toHaveBeenCalled();
    expectLoadingAlwaysReset();
  });
});

describe("7. network failure", () => {
  it("surfaces the error, logs it, and resets loading", async () => {
    const flow = createSignInFlow();
    const r = await flow.submit("a@b.c", "pw", deps(async () => { throw new Error("Failed to fetch"); }));
    expect(r).toEqual({ kind: "unexpected-error", message: "Failed to fetch" });
    expect(log).toHaveBeenCalled(); // not swallowed
    expectLoadingAlwaysReset();
  });
});

describe("8. bootstrap timeout", () => {
  it("a rejected (timed-out) sign-in still resets loading", async () => {
    const flow = createSignInFlow();
    const timeout = Object.assign(new Error("Loading your profile timed out after 10000ms."), { name: "TimeoutError" });
    const r = await flow.submit("a@b.c", "pw", deps(async () => { throw timeout; }));
    expect(r.kind).toBe("unexpected-error");
    expectLoadingAlwaysReset();
  });
});

describe("9. router failure", () => {
  it("resets loading even when navigation throws — success must not depend on it", async () => {
    const flow = createSignInFlow();
    navigate.mockImplementation(() => { throw new Error("navigation failed"); });
    const r = await flow.submit("a@b.c", "pw", deps(async () => ({ ok: true, bootstrap: ready(COMPLETE) })));
    expect(r).toEqual({ kind: "unexpected-error", message: "navigation failed" });
    expectLoadingAlwaysReset();
    expect(flow.isInFlight).toBe(false); // and the form is usable again
  });
});

describe("10. loading state always resets after failure", () => {
  it("holds for every failure mode", async () => {
    const cases: SignInDeps["signIn"][] = [
      async () => ({ ok: false, error: "bad" }),
      async () => ({ ok: true, bootstrap: { status: "error", message: "boom" } }),
      async () => { throw new Error("kaboom"); },
      async () => { throw "a string, not an Error"; },
    ];
    for (const signIn of cases) {
      busy = [];
      const flow = createSignInFlow();
      await flow.submit("a@b.c", "pw", deps(signIn));
      expectLoadingAlwaysReset();
      expect(flow.isInFlight).toBe(false);
    }
  });
});

describe("11. duplicate submission is prevented", () => {
  it("rejects a second submit while one is in flight, and issues ONE request", async () => {
    const flow = createSignInFlow();
    let release!: (v: { ok: false; error: string }) => void;
    const signIn = vi.fn(() => new Promise<{ ok: false; error: string }>((r) => { release = r; }));

    const first = flow.submit("a@b.c", "pw", deps(signIn));
    const second = await flow.submit("a@b.c", "pw", deps(signIn));
    const third = await flow.submit("a@b.c", "pw", deps(signIn));

    expect(second).toEqual({ kind: "ignored-duplicate" });
    expect(third).toEqual({ kind: "ignored-duplicate" });
    expect(signIn).toHaveBeenCalledTimes(1);

    release({ ok: false, error: "Wrong email or password." });
    await first;
    expect(flow.isInFlight).toBe(false);
  });

  it("allows another attempt after a failure", async () => {
    const flow = createSignInFlow();
    const signIn = vi.fn(async () => ({ ok: false as const, error: "Wrong email or password." }));
    await flow.submit("a@b.c", "pw", deps(signIn));
    await flow.submit("a@b.c", "pw2", deps(signIn));
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it("does not emit a busy transition for an ignored duplicate", async () => {
    const flow = createSignInFlow();
    let release!: (v: { ok: false; error: string }) => void;
    const first = flow.submit("a@b.c", "pw", deps(() => new Promise((r) => { release = r; })));
    busy = [];
    await flow.submit("a@b.c", "pw", deps(async () => ({ ok: false, error: "x" })));
    expect(busy).toEqual([]); // the duplicate did not touch the button's state
    release({ ok: false, error: "x" });
    await first;
  });
});

describe("12. retry works", () => {
  it("re-runs bootstrap only, then routes — without re-authenticating", async () => {
    const flow = createSignInFlow();
    const bootstrap = vi.fn(async () => ready(COMPLETE));
    const r = await flow.retry(bootstrap, { navigate, onBusy: (b) => busy.push(b), log });
    expect(r).toEqual({ kind: "navigated", to: "/profile" });
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expectLoadingAlwaysReset();
  });

  it("a retry that fails again stays recoverable rather than freezing", async () => {
    const flow = createSignInFlow();
    const r = await flow.retry(async () => { throw new Error("still down"); }, {
      navigate, onBusy: (b) => busy.push(b), log,
    });
    expect(r).toEqual({ kind: "bootstrap-error", message: "still down" });
    expectLoadingAlwaysReset();
    expect(flow.isInFlight).toBe(false);
  });

  it("routes a retry into onboarding when the profile turns out to be missing", async () => {
    const flow = createSignInFlow();
    const r = await flow.retry(async () => ready(null), { navigate, onBusy: (b) => busy.push(b), log });
    expect(r).toEqual({ kind: "navigated", to: "/onboarding" });
  });
});
