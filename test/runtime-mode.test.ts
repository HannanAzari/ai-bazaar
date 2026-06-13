import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { getRuntimeMode, hasSupabaseEnv, isProductionBackend, runtimeModeLabel } from "@/lib/runtime-mode";
import { getRepositories } from "@/lib/repos";
import { NotImplementedError } from "@/lib/repos/supabase";

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function clearSupabaseEnv() {
  delete process.env[URL_KEY];
  delete process.env[ANON_KEY];
}

describe("runtime mode detection", () => {
  afterEach(clearSupabaseEnv);

  it("is demo when the Supabase env vars are absent", () => {
    clearSupabaseEnv();
    expect(hasSupabaseEnv()).toBe(false);
    expect(getRuntimeMode()).toBe("demo");
    expect(isProductionBackend()).toBe(false);
    expect(runtimeModeLabel("demo")).toMatch(/demo/i);
  });

  it("is production when both Supabase env vars are present", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    process.env[ANON_KEY] = "anon-key";
    expect(hasSupabaseEnv()).toBe(true);
    expect(getRuntimeMode()).toBe("production");
    expect(isProductionBackend()).toBe(true);
    expect(runtimeModeLabel("production")).toMatch(/supabase/i);
  });

  it("stays demo if only one env var is set", () => {
    clearSupabaseEnv();
    process.env[URL_KEY] = "https://example.supabase.co";
    expect(getRuntimeMode()).toBe("demo");
  });
});

describe("repository selection", () => {
  it("returns working local repositories in demo mode", async () => {
    const repos = getRepositories("demo");
    // Local repos delegate to the demo libs and resolve.
    await expect(repos.houses.getStoredHouse("nobody.no.house")).resolves.toBeNull();
    await expect(repos.events.counts()).resolves.toBeTypeOf("object");
    await expect(repos.reports.list()).resolves.toBeInstanceOf(Array);
  });

  it("returns Supabase stubs in production mode that throw NotImplemented", () => {
    const repos = getRepositories("production");
    expect(() => repos.events.list()).toThrow(NotImplementedError);
    expect(() => repos.houses.getStoredHouse("x")).toThrow(/not implemented/i);
    expect(() => repos.profiles.getByHandle("mina")).toThrow(NotImplementedError);
  });

  it("exposes the full repository set", () => {
    const repos = getRepositories("demo");
    expect(Object.keys(repos).sort()).toEqual(["events", "houses", "profiles", "reports", "roomObjects", "rooms"]);
  });
});

describe("schema & migration file presence", () => {
  it("ships the canonical schema and seed", () => {
    expect(existsSync("supabase/schema.sql")).toBe(true);
    expect(existsSync("supabase/seed.sql")).toBe(true);
  });

  it("has the expected, ordered migration set", () => {
    const expected = [
      "20260610_house_exteriors_and_room_zones.sql",
      "20260610_village_model.sql",
      "20260611_01_extend_enums.sql",
      "20260611_02_tags_events_reports.sql",
      "20260612_01_extend_enums.sql",
      "20260612_02_creator_engagement.sql",
      "20260613_collections_activity_assets.sql",
      "20260614_room_engine.sql",
      "20260615_01_extend_enums.sql",
      "20260615_02_room_studio.sql",
      "20260616_extend_enums.sql",
      "20260617_01_extend_enums.sql",
      "20260617_02_multi_room.sql",
    ];
    const present = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    for (const file of expected) expect(present).toContain(file);
    // Filename order is lexicographic = apply order.
    expect([...expected].sort()).toEqual(expected);
  });
});
