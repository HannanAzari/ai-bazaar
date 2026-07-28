import { describe, expect, it } from "vitest";
import { labelFromUrl, profileLinks } from "@/lib/profile-links";

// M20 — creators may add ANY platform. Nothing is hard-coded, legacy profiles keep working.

describe("labelFromUrl", () => {
  it("derives a readable label from the host", () => {
    expect(labelFromUrl("https://open.spotify.com/artist/x")).toBe("Open");
    expect(labelFromUrl("https://store.steampowered.com/")).toBe("Store");
    expect(labelFromUrl("patreon.com/hannan")).toBe("Patreon");
    expect(labelFromUrl("https://www.tiktok.com/@me")).toBe("Tiktok");
  });
  it("falls back for junk", () => {
    expect(labelFromUrl("")).toBe("Link");
  });
});

describe("profileLinks", () => {
  it("returns nothing for an empty profile", () => {
    expect(profileLinks(null)).toEqual([]);
    expect(profileLinks({})).toEqual([]);
  });

  it("still reads the legacy fixed four", () => {
    const out = profileLinks({ socials: { website: "hannan.dev", github: "hannan", twitter: "@hannan", youtube: "youtube.com/@hannan" } });
    expect(out.map((l) => l.label)).toEqual(["Website", "GitHub", "Twitter", "YouTube"]);
    expect(out[0].href).toBe("https://hannan.dev");
    expect(out[1].href).toBe("https://github.com/hannan");
    expect(out[2].href).toBe("https://x.com/hannan");
  });

  it("supports UNLIMITED custom links on any platform", () => {
    const out = profileLinks({
      links: [
        { label: "Spotify", url: "open.spotify.com/artist/x" },
        { label: "Discord", url: "discord.gg/abc" },
        { label: "Patreon", url: "patreon.com/me" },
        { label: "Shop", url: "myshop.com" },
        { url: "https://store.steampowered.com/" }, // no label → derived
      ],
    });
    expect(out).toHaveLength(5);
    expect(out.map((l) => l.label)).toEqual(["Spotify", "Discord", "Patreon", "Shop", "Store"]);
  });

  it("merges legacy + custom and de-duplicates by destination", () => {
    const out = profileLinks({
      socials: { website: "hannan.dev" },
      links: [{ label: "Website", url: "hannan.dev" }, { label: "Shop", url: "shop.com" }],
    });
    expect(out).toHaveLength(2);
    expect(out.map((l) => l.href)).toEqual(["https://hannan.dev", "https://shop.com"]);
  });

  it("drops blank rows and normalises protocols", () => {
    const out = profileLinks({ links: [{ url: "  " }, { url: "example.com" }] });
    expect(out).toHaveLength(1);
    expect(out[0].href).toBe("https://example.com");
  });
});
