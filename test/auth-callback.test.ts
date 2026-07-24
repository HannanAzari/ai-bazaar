import { describe, expect, it } from "vitest";
import { callbackErrorUrl, callbackRedirectUrl, safeNext, NEUTRAL_ROUTE } from "@/lib/auth/callback-redirect";
import { resolveServerSiteUrl, authCallbackUrl } from "@/lib/auth/site-url";

// The bug this guards against: a login started on a Vercel Preview host came back to the
// wrong origin, so the PKCE code was never exchanged there. Every redirect the callback
// builds MUST stay on the origin the request arrived on.
const PREVIEW_HOSTS = [
  "https://ai-bazaar-git-m12-nest-platform-hannan.vercel.app",
  "https://ai-bazaar-abc123xyz-hannan.vercel.app", // per-commit preview URL
  "https://nestudio.app", // production
  "http://localhost:3000", // local dev
];

describe("item 8 · Preview login returns to the INITIATING hostname", () => {
  it("builds the post-exchange redirect on the same origin as the request", () => {
    for (const origin of PREVIEW_HOSTS) {
      const dest = new URL(callbackRedirectUrl(origin, "/profile"));
      expect(dest.origin).toBe(origin); // never a different/hard-coded host
      expect(dest.pathname).toBe(NEUTRAL_ROUTE); // neutral bounce, not the protected page
      expect(dest.searchParams.get("next")).toBe("/profile");
    }
  });

  it("builds the error redirect on the same origin too", () => {
    for (const origin of PREVIEW_HOSTS) {
      const dest = new URL(callbackErrorUrl(origin, "exchange_failed"));
      expect(dest.origin).toBe(origin);
      expect(dest.pathname).toBe("/auth/login");
      expect(dest.searchParams.get("error")).toBe("exchange_failed");
    }
  });

  it("never emits localhost when the request came from a preview host", () => {
    const url = callbackRedirectUrl("https://ai-bazaar-abc123xyz-hannan.vercel.app", "/creator-studio");
    expect(url).not.toContain("localhost");
    expect(url.startsWith("https://ai-bazaar-abc123xyz-hannan.vercel.app/")).toBe(true);
  });
});

describe("next sanitisation (open-redirect safety)", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNext("/profile")).toBe("/profile");
    expect(safeNext("/creator-studio/review")).toBe("/creator-studio/review");
  });
  it("drops protocol-relative and absolute URLs", () => {
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("http://evil.com")).toBeNull();
  });
  it("drops empty / non-path values", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext("profile")).toBeNull();
  });
  it("omits an unsafe next from the redirect entirely", () => {
    const dest = new URL(callbackRedirectUrl("https://preview.vercel.app", "//evil.com"));
    expect(dest.searchParams.has("next")).toBe(false);
    expect(dest.origin).toBe("https://preview.vercel.app");
  });
});

describe("item 7 · server origin precedence — SITE_URL (prod) then VERCEL_URL (preview)", () => {
  it("uses NEXT_PUBLIC_SITE_URL in Production", () => {
    expect(resolveServerSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://nestudio.app", NEXT_PUBLIC_VERCEL_URL: "ignored.vercel.app" }))
      .toBe("https://nestudio.app");
  });
  it("uses NEXT_PUBLIC_VERCEL_URL on Preview (no SITE_URL set), adding https://", () => {
    expect(resolveServerSiteUrl({ NEXT_PUBLIC_VERCEL_URL: "ai-bazaar-abc-hannan.vercel.app" }))
      .toBe("https://ai-bazaar-abc-hannan.vercel.app");
  });
  it("falls back to the system VERCEL_URL when NEXT_PUBLIC_VERCEL_URL is absent", () => {
    expect(resolveServerSiteUrl({ VERCEL_URL: "branch-xyz.vercel.app" }))
      .toBe("https://branch-xyz.vercel.app");
  });
  it("falls back to localhost only when nothing is configured (never a baked prod host)", () => {
    expect(resolveServerSiteUrl({})).toBe("http://localhost:3000");
  });
  it("strips trailing slashes", () => {
    expect(resolveServerSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://nestudio.app/" })).toBe("https://nestudio.app");
  });
});

describe("authCallbackUrl", () => {
  it("targets /auth/callback and carries a safe next", () => {
    const url = new URL(authCallbackUrl("/profile"));
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("next")).toBe("/profile");
  });
  it("omits an unsafe next", () => {
    const url = new URL(authCallbackUrl("//evil.com"));
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.has("next")).toBe(false);
  });
});
