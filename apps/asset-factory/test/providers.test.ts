import { describe, it, expect } from "vitest";
import { PROVIDERS, PROVIDER_IDS, isProvider, providerLabel } from "@/lib/providers";

describe("provider metadata (client-safe)", () => {
  it("defines exactly Replicate + OpenAI", () => {
    expect(PROVIDER_IDS).toEqual(["replicate", "openai"]);
    expect(PROVIDERS).toHaveLength(2);
  });

  it("guards provider ids", () => {
    expect(isProvider("replicate")).toBe(true);
    expect(isProvider("openai")).toBe(true);
    expect(isProvider("midjourney")).toBe(false);
  });

  it("labels providers", () => {
    expect(providerLabel("replicate")).toContain("Replicate");
    expect(providerLabel("openai")).toContain("OpenAI");
  });
});
