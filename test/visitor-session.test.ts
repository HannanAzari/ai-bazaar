import { describe, expect, it } from "vitest";
import { endSession, startSession } from "@/lib/visitor-session";
import { loadVisitor, readSessionId, readVisitorId } from "@/lib/visitor-id";
import { getEvents } from "@/lib/events";

describe("visitor sessions (anonymous, no auth)", () => {
  it("creates a persistent visitor on first visit and marks it new", () => {
    const session = startSession("shop-1");
    expect(session).not.toBeNull();
    expect(session?.isNew).toBe(true);
    expect(session?.isReturning).toBe(false);
    expect(session?.visitorId).toMatch(/^vis-/);
    expect(session?.sessionId).toMatch(/^ses-/);
    expect(readVisitorId()).toBe(session?.visitorId);
    expect(readSessionId()).toBe(session?.sessionId);
  });

  it("emits session_started exactly once per session (idempotent)", () => {
    startSession("shop-1");
    const again = startSession("shop-1");
    expect(again?.isNew).toBe(false);
    expect(getEvents().filter((event) => event.type === "session_started")).toHaveLength(1);
  });

  it("treats a later visit (after the session ends) as returning", () => {
    const first = startSession("shop-1");
    endSession();
    const second = startSession("shop-1");
    expect(second?.visitorId).toBe(first?.visitorId); // same visitor id persists
    expect(second?.isReturning).toBe(true);
    expect(second?.isNew).toBe(true); // a genuinely new session
  });

  it("counts sessions on the persistent visitor record", () => {
    startSession("shop-1");
    endSession();
    startSession("shop-1");
    expect(loadVisitor()?.sessions).toBe(2);
  });

  it("emits session_ended with a non-negative duration and clears the session", () => {
    startSession("shop-1");
    const ended = endSession();
    expect(ended).not.toBeNull();
    expect(ended!.durationMs).toBeGreaterThanOrEqual(0);
    expect(readSessionId()).toBeUndefined();
    const event = getEvents().find((item) => item.type === "session_ended");
    expect(Number(event?.metadata?.durationMs)).toBeGreaterThanOrEqual(0);
  });

  it("ending with no active session is a no-op", () => {
    expect(endSession()).toBeNull();
  });

  it("tags session_started with the returning flag", () => {
    startSession("shop-1");
    const started = getEvents().find((event) => event.type === "session_started");
    expect(started?.metadata?.returning).toBe(false);
  });
});
