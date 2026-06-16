import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { friendlyError } from "@/lib/errors";

describe("friendlyError", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("maps known Supabase auth errors to calm copy", () => {
    expect(friendlyError(new Error("Invalid login credentials"), "signin")).toMatch(/doesn't match/i);
    expect(friendlyError(new Error("User already registered"), "signup")).toMatch(/already exists/i);
    expect(friendlyError({ message: "Email address \"x\" is invalid" }, "signup")).toMatch(/valid email/i);
    expect(friendlyError(new Error("over_email_send_rate_limit"), "signup")).toMatch(/too many/i);
    expect(friendlyError(new Error("Email not confirmed"), "signin")).toMatch(/confirm/i);
  });

  it("maps persistence + network errors", () => {
    expect(friendlyError(new Error("No shop found for address moon.x.y"), "claim")).toMatch(/couldn't find your nest/i);
    expect(friendlyError(new Error("Failed to fetch"), "save")).toMatch(/offline/i);
  });

  it("falls back to the context default for unknown errors", () => {
    expect(friendlyError(new Error("kaboom 12345"), "save")).toMatch(/couldn't save/i);
    expect(friendlyError(new Error("kaboom"), "upload")).toMatch(/image couldn't be uploaded/i);
    expect(friendlyError(null, "load")).toMatch(/couldn't load/i);
    expect(friendlyError("weird", "generic")).toMatch(/something went wrong/i);
  });

  it("never leaks the raw message but logs it for developers", () => {
    const spy = vi.spyOn(console, "error");
    const out = friendlyError(new Error("PGRST500 internal column zzz"), "save");
    expect(out).not.toMatch(/PGRST500|zzz/);
    expect(spy).toHaveBeenCalled();
  });
});
