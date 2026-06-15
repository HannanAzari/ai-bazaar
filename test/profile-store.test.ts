import { describe, it, expect, beforeEach } from "vitest";
import { ensureProfile, getProfile, handleFromName, updateProfile } from "@/lib/profile-store";
import { getRepositories } from "@/lib/repos";
import type { SessionUser } from "@/lib/auth/types";

const user: SessionUser = { id: "u1", email: "jane@example.com", name: "Jane Doe" };

describe("handleFromName", () => {
  it("slugifies to a lowercase handle", () => {
    expect(handleFromName("Jane Doe")).toBe("jane-doe");
    expect(handleFromName("  Cosy Kettle!! ")).toBe("cosy-kettle");
    expect(handleFromName("")).toBe("creator");
  });
});

describe("demo profile store", () => {
  beforeEach(() => localStorage.clear());

  it("creates a profile on first ensure, then is idempotent", () => {
    expect(getProfile("u1")).toBeNull();
    const created = ensureProfile(user);
    expect(created).toMatchObject({ id: "u1", displayName: "Jane Doe", username: "jane-doe", isAdmin: false });
    // Second ensure returns the same profile, not a new one.
    const again = ensureProfile({ ...user, name: "Changed" });
    expect(again.displayName).toBe("Jane Doe");
  });

  it("loads a profile by id", () => {
    ensureProfile(user);
    expect(getProfile("u1")?.displayName).toBe("Jane Doe");
  });

  it("updates mutable fields but never isAdmin", () => {
    ensureProfile(user);
    const updated = updateProfile("u1", { bio: "Potter & tea drinker", displayName: "Jane D." });
    expect(updated.bio).toBe("Potter & tea drinker");
    expect(updated.displayName).toBe("Jane D.");
    expect(updated.isAdmin).toBe(false);
  });
});

describe("local profile repository", () => {
  beforeEach(() => localStorage.clear());

  it("ensures + loads + updates through the repo seam", async () => {
    const repo = getRepositories("demo").profiles;
    const ensured = await repo.ensureProfile(user);
    expect(ensured.id).toBe("u1");
    expect(await repo.getById("u1")).not.toBeNull();
    const updated = await repo.update("u1", { bio: "hi" });
    expect(updated.bio).toBe("hi");
  });
});
