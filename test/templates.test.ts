import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM_SHELL_ID,
  getRoomShell,
  listRoomShells,
} from "@/lib/templates/room-shells";
import {
  DEFAULT_EXTERIOR_SHELL_ID,
  getExteriorShell,
  listExteriorShells,
} from "@/lib/templates/exterior-shells";
import type { VisualTemplate } from "@/lib/types";

// Every visual-kit template must carry the shared metadata (ADR-022).
function expectSharedMetadata(t: VisualTemplate) {
  expect(t.id).toBeTruthy();
  expect(t.name).toBeTruthy();
  expect(t.imageUrl).toMatch(/\.(svg|png|webp|jpg)$/);
  expect(t.width).toBeGreaterThan(0);
  expect(t.height).toBeGreaterThan(0);
  expect(t.styleFamily).toBeTruthy();
  expect(t.personalityTags.length).toBeGreaterThan(0);
  expect(t.compatibleUseCases.length).toBeGreaterThan(0);
  expect(t.version).toBeGreaterThanOrEqual(1);
  for (const r of [t.safeArea]) {
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  }
}

describe("room shell template registry", () => {
  it("loads the default room shell and lists registered shells", () => {
    expect(listRoomShells().length).toBeGreaterThanOrEqual(1);
    const shell = getRoomShell(DEFAULT_ROOM_SHELL_ID);
    expect(shell).toBeTruthy();
    expect(shell!.kind).toBe("room-shell");
    expectSharedMetadata(shell!);
  });

  it("has calibrated placement zones + room-specific bounds", () => {
    const shell = getRoomShell()!;
    expect(shell.placementZones.length).toBeGreaterThanOrEqual(4);
    for (const z of shell.placementZones) {
      expect(z.cx).toBeGreaterThanOrEqual(0);
      expect(z.cx).toBeLessThanOrEqual(1);
      expect(z.width).toBeGreaterThan(0);
    }
    expect(shell.floorBounds.height).toBeGreaterThan(0);
    expect(shell.wallBounds.height).toBeGreaterThan(0);
    expect(["warm", "cool", "neutral"]).toContain(shell.lightingTone);
  });

  it("returns undefined for an unknown room shell id", () => {
    expect(getRoomShell("nope")).toBeUndefined();
  });
});

describe("exterior shell template registry", () => {
  it("loads the default exterior shell and lists registered shells", () => {
    expect(listExteriorShells().length).toBeGreaterThanOrEqual(1);
    const shell = getExteriorShell(DEFAULT_EXTERIOR_SHELL_ID);
    expect(shell).toBeTruthy();
    expect(shell!.kind).toBe("exterior-shell");
    expectSharedMetadata(shell!);
  });

  it("has the required exterior metadata (door + sign bounds, version, tags)", () => {
    const shell = getExteriorShell()!;
    expect(shell.styleFamily).toBe("nestudio-cozy");
    expect(shell.doorBounds.width).toBeGreaterThan(0);
    expect(shell.signBounds.width).toBeGreaterThan(0);
    expect(shell.compatibleUseCases).toContain("village-card");
  });

  it("returns undefined for an unknown exterior shell id", () => {
    expect(getExteriorShell("nope")).toBeUndefined();
  });
});
