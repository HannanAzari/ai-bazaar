import { describe, expect, it, vi } from "vitest";
import { SupabaseAuthClient } from "@/lib/auth/supabase-auth";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── HOTFIX M23B.2 — signup only succeeds when Supabase created a user ────────
//
// Verified against the live project on 2026-07-28: email confirmation is OFF there, so a
// genuine signup returns BOTH a user and a session immediately, and a duplicate email
// returns a 422 error. Every other response shape must be treated as a failure — the
// founder's account went missing precisely because a non-success was allowed through.

function clientReturning(response: unknown): SupabaseClient {
  return { auth: { signUp: vi.fn().mockResolvedValue(response) } } as unknown as SupabaseClient;
}

const USER = {
  id: "d1acb9a0-0000-4000-8000-000000000001",
  email: "ada@example.com",
  user_metadata: { display_name: "Ada" },
  identities: [{ id: "i1" }],
};
const SESSION = { access_token: "eyJhbGciOi.real.token" };

describe("signUp accepts only a genuine account", () => {
  it("succeeds when a user AND a session come back (confirmation off)", async () => {
    const auth = new SupabaseAuthClient(clientReturning({ data: { user: USER, session: SESSION }, error: null }));
    const user = await auth.signUp({ email: "ada@example.com", password: "supersecret" });
    expect(user.id).toBe(USER.id);
    expect(user.email).toBe("ada@example.com");
    expect(user.name).toBe("Ada");
  });

  it("rejects when Supabase returns an error (e.g. duplicate email, 422)", async () => {
    const auth = new SupabaseAuthClient(
      clientReturning({ data: { user: null, session: null }, error: new Error("User already registered") }),
    );
    await expect(auth.signUp({ email: "ada@example.com", password: "supersecret" })).rejects.toThrow(
      "User already registered",
    );
  });

  it("rejects when NO user comes back — nothing was created", async () => {
    const auth = new SupabaseAuthClient(clientReturning({ data: { user: null, session: null }, error: null }));
    await expect(auth.signUp({ email: "ada@example.com", password: "supersecret" })).rejects.toThrow(
      /did not create an account/i,
    );
  });

  it("rejects a user object with no id", async () => {
    const auth = new SupabaseAuthClient(
      clientReturning({ data: { user: { email: "ada@example.com" }, session: SESSION }, error: null }),
    );
    await expect(auth.signUp({ email: "ada@example.com", password: "supersecret" })).rejects.toThrow(
      /did not create an account/i,
    );
  });

  it("detects the anti-enumeration 'already registered' response (empty identities)", async () => {
    // Supabase can return a user-SHAPED object with identities:[] for an email that
    // already exists. Without this check it looks like a new signup awaiting confirmation,
    // so the person is told to check an email that never arrives.
    const auth = new SupabaseAuthClient(
      clientReturning({ data: { user: { ...USER, identities: [] }, session: null }, error: null }),
    );
    await expect(auth.signUp({ email: "ada@example.com", password: "supersecret" })).rejects.toThrow(
      /already exists. Sign in instead/i,
    );
  });

  it("reports 'confirm your email' only for a REAL user with no session", async () => {
    const auth = new SupabaseAuthClient(clientReturning({ data: { user: USER, session: null }, error: null }));
    await expect(auth.signUp({ email: "ada@example.com", password: "supersecret" })).rejects.toThrow(
      /Check your email to confirm/i,
    );
  });

  it("rejects a session object with no access token", async () => {
    const auth = new SupabaseAuthClient(
      clientReturning({ data: { user: USER, session: { access_token: "" } }, error: null }),
    );
    await expect(auth.signUp({ email: "ada@example.com", password: "supersecret" })).rejects.toThrow(
      /Check your email to confirm/i,
    );
  });

  it("never resolves for any non-success shape", async () => {
    const shapes = [
      { data: { user: null, session: null }, error: null },
      { data: { user: USER, session: null }, error: null },
      { data: { user: { ...USER, identities: [] }, session: null }, error: null },
      { data: { user: { ...USER, id: "" }, session: SESSION }, error: null },
    ];
    for (const shape of shapes) {
      const auth = new SupabaseAuthClient(clientReturning(shape));
      await expect(auth.signUp({ email: "ada@example.com", password: "supersecret" })).rejects.toThrow();
    }
  });
});
