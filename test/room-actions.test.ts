import { describe, it, expect, beforeEach } from "vitest";
import { contactMethods, faviconUrl, galleryImages, hasActionData, hostname, productCard } from "@/lib/room-actions";
import { videoEmbed } from "@/lib/embeds";
import { eventCounts, getEvents, trackEvent } from "@/lib/events";

describe("gallery validation", () => {
  it("keeps only images with a real source", () => {
    const images = galleryImages({ images: [
      { src: "a.jpg", caption: "A" },
      { src: "   ", caption: "blank" },
      { src: "" },
      { src: "b.png" },
    ] });
    expect(images.map((i) => i.src)).toEqual(["a.jpg", "b.png"]);
  });
  it("returns empty when there are no images", () => {
    expect(galleryImages(undefined)).toEqual([]);
    expect(galleryImages({})).toEqual([]);
  });
});

describe("video validation", () => {
  it("parses YouTube watch / share / shorts URLs to an embed URL", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=ysz5S6PUM-U")?.embedUrl).toBe("https://www.youtube.com/embed/ysz5S6PUM-U");
    expect(videoEmbed("https://youtu.be/ysz5S6PUM-U")?.provider).toBe("youtube");
    expect(videoEmbed("https://www.youtube.com/watch?v=ysz5S6PUM-U&t=30s")?.embedUrl).toBe("https://www.youtube.com/embed/ysz5S6PUM-U");
    expect(videoEmbed("https://youtube.com/shorts/abc123XYZ")?.provider).toBe("youtube");
  });
  it("parses Vimeo URLs", () => {
    expect(videoEmbed("https://vimeo.com/123456789")?.embedUrl).toBe("https://player.vimeo.com/video/123456789");
  });
  it("returns null for unknown, local, or empty input", () => {
    expect(videoEmbed("https://example.com/clip.mp4")).toBeNull();
    expect(videoEmbed("")).toBeNull();
    expect(videoEmbed(undefined)).toBeNull();
  });
});

describe("product validation", () => {
  it("is null when there is nothing to show", () => {
    expect(productCard({})).toBeNull();
    expect(productCard(undefined)).toBeNull();
  });
  it("builds a card and normalises the URL", () => {
    expect(productCard({ title: "Mug", price: "$28", url: "example.com/mug", image: "x.jpg" })).toEqual({
      title: "Mug",
      price: "$28",
      image: "x.jpg",
      url: "https://example.com/mug",
    });
  });
  it("falls back to a title when only a URL is set", () => {
    expect(productCard({ url: "https://x.com" })?.title).toBe("Untitled item");
  });
});

describe("contact validation", () => {
  it("builds clickable methods with correct hrefs", () => {
    const methods = contactMethods({
      email: "a@b.com",
      website: "example.com",
      phone: "+1 555 0100",
      socials: [{ label: "GitHub", url: "github.com/x" }],
    });
    const byType = Object.fromEntries(methods.map((m) => [m.type, m.href]));
    expect(byType.email).toBe("mailto:a@b.com");
    expect(byType.website).toBe("https://example.com");
    expect(byType.phone).toBe("tel:+15550100");
    expect(byType.social).toBe("https://github.com/x");
  });
  it("is empty with no contact data", () => {
    expect(contactMethods({})).toEqual([]);
    expect(contactMethods(undefined)).toEqual([]);
  });
});

describe("url helpers", () => {
  it("derives hostnames and favicons", () => {
    expect(hostname("https://www.example.com/path")).toBe("example.com");
    expect(hostname("example.com")).toBe("example.com");
    expect(hostname("")).toBeNull();
    expect(faviconUrl("example.com")).toContain("example.com");
    expect(faviconUrl(undefined)).toBeNull();
  });
});

describe("hasActionData (graceful inert vs active)", () => {
  it("treats unconfigured actions as inert and configured ones as active", () => {
    expect(hasActionData("none")).toBe(false);
    expect(hasActionData("profile")).toBe(true);
    expect(hasActionData("guestbook")).toBe(true);
    expect(hasActionData("gallery", {})).toBe(false);
    expect(hasActionData("gallery", { images: [{ src: "a.jpg" }] })).toBe(true);
    expect(hasActionData("product", {})).toBe(false);
    expect(hasActionData("product", { title: "Mug" })).toBe(true);
    expect(hasActionData("contact", {})).toBe(false);
    expect(hasActionData("contact", { email: "a@b.com" })).toBe(true);
    expect(hasActionData("link", {})).toBe(false);
    expect(hasActionData("link", { url: "https://x.com" })).toBe(true);
  });
});

describe("analytics tracking", () => {
  beforeEach(() => localStorage.clear());
  it("records V3 visitor interaction events and counts them", () => {
    trackEvent("gallery_opened", { shopId: "s1", targetId: "o1" });
    trackEvent("video_opened", { shopId: "s1", targetId: "o2" });
    trackEvent("product_opened", { shopId: "s1" });
    trackEvent("contact_opened", { shopId: "s1" });
    trackEvent("profile_opened", { shopId: "s1" });

    const counts = eventCounts();
    expect(counts.gallery_opened).toBe(1);
    expect(counts.video_opened).toBe(1);
    expect(counts.product_opened).toBe(1);
    expect(counts.contact_opened).toBe(1);
    expect(counts.profile_opened).toBe(1);
    expect(getEvents()).toHaveLength(5);
  });
});
