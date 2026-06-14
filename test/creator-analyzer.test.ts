import { describe, it, expect } from "vitest";
import {
  analyzeCreator,
  domainWords,
  extractUsername,
  generateCreatorRoom,
  welcomeMessage,
} from "@/lib/creator-analyzer";
import { findZone, validatePlacement } from "@/lib/room-schema";
import { getAsset } from "@/lib/assets";

const ADDRESS = "moon.test.room";

describe("URL parsing", () => {
  it("extracts a username from a social URL (handles @ and bare paths)", () => {
    expect(extractUsername("https://instagram.com/janedoe", "instagram")).toBe("janedoe");
    expect(extractUsername("tiktok.com/@jane.codes", "tiktok")).toBe("jane.codes");
    expect(extractUsername("https://youtube.com/@janefilms", "youtube")).toBe("janefilms");
  });
  it("returns undefined for a website (no handle) or junk", () => {
    expect(extractUsername("https://jane.com", "website")).toBeUndefined();
    expect(extractUsername("not a url", "instagram")).toBeUndefined();
    expect(extractUsername(undefined, "instagram")).toBeUndefined();
  });
  it("extracts significant domain words (drops www + TLD, splits camel/sep)", () => {
    expect(domainWords("https://jane-photography.com")).toEqual(["jane", "photography"]);
    expect(domainWords("www.dev-studio.io")).toEqual(["dev", "studio"]);
    expect(domainWords("bad url")).toEqual([]);
  });
});

describe("social link extraction", () => {
  it("builds links only for supplied platforms, in fixed order", () => {
    const a = analyzeCreator({ youtubeUrl: "youtube.com/@chan", instagramUrl: "instagram.com/me" });
    expect(a.socialLinks.map((l) => l.platform)).toEqual(["instagram", "youtube"]);
    expect(a.socialLinks[0].label).toBe("Instagram");
    expect(a.socialLinks[1].url).toContain("youtube.com");
  });
  it("ignores empty / invalid input entirely", () => {
    const a = analyzeCreator({});
    expect(a.socialLinks).toEqual([]);
    expect(a.creatorType).toBe("personal"); // fallback
  });
});

describe("creator type detection", () => {
  it("detects from bio keywords", () => {
    expect(analyzeCreator({ bio: "Wedding photographer and storyteller" }).creatorType).toBe("photographer");
    expect(analyzeCreator({ bio: "Full-stack developer building apps" }).creatorType).toBe("developer");
    expect(analyzeCreator({ bio: "Independent consultant and advisor" }).creatorType).toBe("consultant");
  });
  it("detects from domain words when no bio", () => {
    expect(analyzeCreator({ websiteUrl: "https://jane-photography.com" }).creatorType).toBe("photographer");
  });
  it("infers from platform when nothing else matches", () => {
    expect(analyzeCreator({ youtubeUrl: "youtube.com/@x" }).creatorType).toBe("podcaster");
    expect(analyzeCreator({ instagramUrl: "instagram.com/x" }).creatorType).toBe("photographer");
    expect(analyzeCreator({ tiktokUrl: "tiktok.com/@x" }).creatorType).toBe("personal");
  });
});

describe("confidence scoring", () => {
  it("rises with more signals and stays within 0..1", () => {
    const none = analyzeCreator({}).confidence;
    const one = analyzeCreator({ instagramUrl: "instagram.com/x" }).confidence;
    const many = analyzeCreator({
      instagramUrl: "instagram.com/x",
      youtubeUrl: "youtube.com/@x",
      websiteUrl: "jane-photography.com",
      bio: "Wedding photographer taking bookings",
    }).confidence;
    expect(none).toBe(0);
    expect(one).toBeGreaterThan(none);
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThanOrEqual(1);
  });
});

describe("welcome message", () => {
  it("is a deterministic sentence mentioning the space + purpose", () => {
    const a = analyzeCreator({ bio: "Wedding photographer taking bookings" });
    const msg = welcomeMessage(a);
    expect(msg.startsWith("Welcome to my ")).toBe(true);
    expect(msg.endsWith(".")).toBe(true);
    expect(msg.toLowerCase()).toContain("photography studio");
  });
});

describe("creator room generation", () => {
  it("creates a profile object and one link object per supplied platform", () => {
    const built = generateCreatorRoom({
      instagramUrl: "instagram.com/jane",
      youtubeUrl: "youtube.com/@jane",
      websiteUrl: "jane-photography.com",
      bio: "Wedding photographer",
    }, ADDRESS);
    expect(built.profileCreated).toBe(true);
    expect(built.socialObjects).toBe(3);
    const profileObjects = built.result.room.objects.filter((o) => o.actionType === "profile");
    expect(profileObjects.length).toBeGreaterThanOrEqual(1);
    const linkObjects = built.result.room.objects.filter((o) => o.actionType === "link");
    expect(linkObjects.length).toBeGreaterThanOrEqual(3);
  });
  it("sets a welcome message as the room description", () => {
    const built = generateCreatorRoom({ bio: "Wedding photographer taking bookings" }, ADDRESS);
    expect(built.result.room.description).toBe(welcomeMessage(built.analysis));
  });
  it("produces a valid room (every object in a legal, in-capacity zone)", () => {
    const built = generateCreatorRoom({
      instagramUrl: "instagram.com/jane",
      tiktokUrl: "tiktok.com/@jane",
      youtubeUrl: "youtube.com/@jane",
      websiteUrl: "jane.com",
      bio: "Artist and maker",
    }, ADDRESS);
    for (const obj of built.result.room.objects) {
      const asset = getAsset(obj.assetId)!;
      const zone = findZone(built.result.room, obj.zoneId)!;
      expect(zone.allowedCategories).toContain(asset.category);
      expect(validatePlacement(built.result.room, asset.category, obj.zoneId, obj.id)).toBe(true);
    }
  });
  it("embeds the social URLs in the link objects' action data", () => {
    const built = generateCreatorRoom({ instagramUrl: "instagram.com/jane" }, ADDRESS);
    const ig = built.result.room.objects.find((o) => o.label === "Instagram");
    expect(ig?.actionData?.url).toContain("instagram.com/jane");
  });
});

describe("determinism", () => {
  it("identical input yields the identical analysis and room composition", () => {
    const input = { instagramUrl: "instagram.com/jane", bio: "Wedding photographer taking bookings" };
    const a = generateCreatorRoom(input, ADDRESS);
    const b = generateCreatorRoom(input, ADDRESS);
    expect(a.analysis).toEqual(b.analysis);
    expect(a.result.room.objects.map((o) => o.assetId)).toEqual(b.result.room.objects.map((o) => o.assetId));
    expect(a.result.room.objects.map((o) => o.label)).toEqual(b.result.room.objects.map((o) => o.label));
    expect(a.welcome).toBe(b.welcome);
  });
});
