import { beforeEach, describe, expect, it } from "vitest";
import { clearLocalSessionState, SESSION_SCOPED_KEYS } from "@/lib/nest-session-reset";

// M23B §2 — sign-out must not leave the previous creator's state on the device, and must
// not delete anything that belongs to the account rather than the browser.
describe("clearLocalSessionState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("removes every session-scoped key", () => {
    for (const k of SESSION_SCOPED_KEYS) window.localStorage.setItem(k, "x");
    clearLocalSessionState();
    for (const k of SESSION_SCOPED_KEYS) expect(window.localStorage.getItem(k)).toBeNull();
  });

  it("removes every editor autosave, however many there are", () => {
    // Removing while iterating by index used to skip every other key — hence the
    // snapshot-first implementation. Several entries make that regression visible.
    window.localStorage.setItem("nestudio:nest-editor:v1:nest-a", "{}");
    window.localStorage.setItem("nestudio:nest-editor:v1:nest-b", "{}");
    window.localStorage.setItem("nestudio:nest-editor:v1:nest-c", "{}");
    clearLocalSessionState();
    expect(window.localStorage.getItem("nestudio:nest-editor:v1:nest-a")).toBeNull();
    expect(window.localStorage.getItem("nestudio:nest-editor:v1:nest-b")).toBeNull();
    expect(window.localStorage.getItem("nestudio:nest-editor:v1:nest-c")).toBeNull();
  });

  it("leaves shared reference data alone", () => {
    // The curated library is public and identical for everyone — wiping it on sign-out
    // would just make the next page load slower for no privacy gain.
    window.localStorage.setItem("nestudio-production-library", "{}");
    window.localStorage.setItem("unrelated-app-key", "keep-me");
    clearLocalSessionState();
    expect(window.localStorage.getItem("nestudio-production-library")).toBe("{}");
    expect(window.localStorage.getItem("unrelated-app-key")).toBe("keep-me");
  });

  it("is safe to call when nothing is stored", () => {
    expect(() => clearLocalSessionState()).not.toThrow();
  });
});
