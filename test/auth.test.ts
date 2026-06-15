import { describe, it, expect, beforeEach } from "vitest";
import { DemoAuthClient } from "@/lib/auth/demo-auth";
import { SupabaseAuthClient } from "@/lib/auth/supabase-auth";
import { getAuthClient } from "@/lib/auth";
import { nameFromEmail } from "@/lib/auth/types";

describe("nameFromEmail", () => {
  it("derives a friendly name from the local part", () => {
    expect(nameFromEmail("jane.doe@example.com")).toBe("Jane Doe");
    expect(nameFromEmail("mina_makes@x.io")).toBe("Mina Makes");
    expect(nameFromEmail("@weird")).toBe("Creator");
  });
});

describe("demo auth flow", () => {
  beforeEach(() => localStorage.clear());

  it("starts with no session", async () => {
    expect(await new DemoAuthClient().getInitialUser()).toBeNull();
  });

  it("signs up, persists the session, and reads it back", async () => {
    const client = new DemoAuthClient();
    const user = await client.signUp({ email: "jane@example.com", password: "x", name: "Jane" });
    expect(user).toMatchObject({ email: "jane@example.com", name: "Jane" });
    // A fresh client reads the persisted session (localStorage).
    expect(await new DemoAuthClient().getInitialUser()).toMatchObject({ email: "jane@example.com", name: "Jane" });
  });

  it("sign-in derives a name and keeps a stored one", async () => {
    const client = new DemoAuthClient();
    const a = await client.signIn({ email: "mina.makes@x.io", password: "" });
    expect(a.name).toBe("Mina Makes");
    await client.signUp({ email: "kai@x.io", password: "", name: "Kai R" });
    const b = await client.signIn({ email: "kai@x.io", password: "" });
    expect(b.name).toBe("Kai R");
  });

  it("signs out and clears the session", async () => {
    const client = new DemoAuthClient();
    await client.signUp({ email: "jane@example.com", password: "x" });
    await client.signOut();
    expect(await client.getInitialUser()).toBeNull();
  });

  it("shares the ai-bazaar-user key with the demo provider", async () => {
    await new DemoAuthClient().signIn({ email: "jane@example.com", password: "" });
    expect(localStorage.getItem("ai-bazaar-user")).toContain("jane@example.com");
  });
});

describe("auth client selection", () => {
  it("returns the demo client in demo mode", () => {
    expect(getAuthClient("demo")).toBeInstanceOf(DemoAuthClient);
  });
  it("throws for production without a Supabase client (no env in tests)", () => {
    // SupabaseAuthClient requires a real client; constructing without env throws.
    expect(() => new SupabaseAuthClient(null)).toThrow(/supabase client unavailable/i);
  });
});

describe("supabase auth (mocked client)", () => {
  function mockClient(overrides: Record<string, unknown> = {}) {
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: "u1", email: "jane@x.io", user_metadata: { display_name: "Jane" } } }, error: null }),
        signInWithPassword: async () => ({ data: { user: { id: "u1", email: "jane@x.io", user_metadata: {} } }, error: null }),
        // Default: confirmation OFF → a session is returned.
        signUp: async () => ({ data: { user: { id: "u1", email: "jane@x.io", user_metadata: { display_name: "Jane" } }, session: { access_token: "t" } }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        ...overrides,
      },
    } as never;
  }

  it("maps the Supabase user to a SessionUser (display_name)", async () => {
    const client = new SupabaseAuthClient(mockClient());
    expect(await client.getInitialUser()).toEqual({ id: "u1", email: "jane@x.io", name: "Jane" });
  });

  it("derives a name from email when metadata is absent (sign-in)", async () => {
    const client = new SupabaseAuthClient(mockClient());
    expect(await client.signIn({ email: "jane@x.io", password: "pw" })).toEqual({ id: "u1", email: "jane@x.io", name: "Jane" });
  });

  it("sign-up returns the user when a session is present", async () => {
    const client = new SupabaseAuthClient(mockClient());
    expect(await client.signUp({ email: "jane@x.io", password: "pw", name: "Jane" })).toEqual({ id: "u1", email: "jane@x.io", name: "Jane" });
  });

  it("sign-up with email confirmation pending (no session) asks to confirm", async () => {
    const client = new SupabaseAuthClient(mockClient({
      signUp: async () => ({ data: { user: { id: "u1", email: "jane@x.io", user_metadata: {} }, session: null }, error: null }),
    }));
    await expect(client.signUp({ email: "jane@x.io", password: "pw" })).rejects.toThrow(/confirm/i);
  });
});
