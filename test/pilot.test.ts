import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { eventLabels } from "@/lib/events";
import type { EventType } from "@/lib/types";

describe("pilot funnel events", () => {
  const funnel: EventType[] = ["signup_completed", "onboarding_completed", "first_nest_created", "room_saved"];
  it("has a human label for each pilot event", () => {
    for (const e of funnel) {
      expect(eventLabels[e]).toBeTruthy();
      expect(typeof eventLabels[e]).toBe("string");
    }
  });
  it("keeps room_view for public-room-viewed (no duplicate event)", () => {
    expect(eventLabels.room_view).toBeTruthy();
  });
});

describe("legal / trust routes exist", () => {
  it.each(["privacy", "terms", "safety", "contact"])("ships app/%s/page.tsx", (route) => {
    expect(existsSync(`app/${route}/page.tsx`)).toBe(true);
  });
});

describe("pilot docs exist", () => {
  it.each(["pilot-readiness.md", "pilot-ops.md", "analytics-plan.md", "staging-checklist.md"])("ships docs/%s", (doc) => {
    expect(existsSync(`docs/${doc}`)).toBe(true);
  });
});
