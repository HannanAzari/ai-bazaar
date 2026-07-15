import { describe, it, expect } from "vitest";
import {
  listAssetProviders,
  getAssetProvider,
  ACTIVE_ASSET_PROVIDER,
  FALLBACK_ASSET_PROVIDER,
  generateAsset,
} from "../lib/asset-pipeline";

describe("asset-pipeline provider registry (the swappable seam)", () => {
  it("registers GPT Image, Gemini, Imagen, Flux and a local fallback", () => {
    const ids = listAssetProviders().map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["gpt-image", "gemini", "imagen", "flux", "local"]));
  });

  it("has a single configured active provider and a local fallback", () => {
    expect(typeof ACTIVE_ASSET_PROVIDER).toBe("string");
    expect(FALLBACK_ASSET_PROVIDER).toBe("local");
    // the active provider must be a real registered provider
    expect(() => getAssetProvider(ACTIVE_ASSET_PROVIDER)).not.toThrow();
  });

  it("resolves a provider by id and throws on an unknown one", () => {
    expect(getAssetProvider("gemini").label).toBe("Google Gemini");
    expect(() => getAssetProvider("stable-diffusion-42")).toThrow(/unknown asset provider/i);
  });

  it("every provider is thin: id, label, isAvailable, generate", () => {
    for (const p of listAssetProviders()) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.label).toBe("string");
      expect(typeof p.isAvailable).toBe("function");
      expect(typeof p.generate).toBe("function");
    }
  });
});

describe("generateAsset honesty (no silent substitution)", () => {
  const req = {
    cutout: { width: 8, height: 8, dataUrl: "data:image/png;base64,AAAA" },
    subject: "coffee mug",
    variants: 2,
  };

  it("surfaces an unconfigured provider's error instead of faking an image", async () => {
    // imagen has no key → its generate() throws; with fallback OFF we must get an
    // honest empty result carrying the error, never a fabricated candidate.
    const res = await generateAsset(req, { provider: "imagen", allowFallback: false });
    expect(res.provider).toBe("imagen");
    expect(res.candidates).toHaveLength(0);
    expect(res.usedFallback).toBe(false);
    expect(res.error).toMatch(/not configured|no api key/i);
  });
});
