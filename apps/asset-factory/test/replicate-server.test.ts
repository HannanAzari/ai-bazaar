import { describe, it, expect, afterEach, vi } from "vitest";
import {
  extractImageUrls,
  runReplicate,
  isReplicateConfigured,
  friendlyProviderError,
  type ReplicateTransport,
} from "@/lib/replicate-server";
import { getGenerationConfig } from "@/lib/generation-config";

const ORIGINAL_TOKEN = process.env.REPLICATE_API_TOKEN;
afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.REPLICATE_API_TOKEN;
  else process.env.REPLICATE_API_TOKEN = ORIGINAL_TOKEN;
});

function fakeRes(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

const config = { ...getGenerationConfig(), timeoutMs: 2000, retryLimit: 1 };

describe("replicate output parsing", () => {
  it("normalizes string / array / nested output to image urls", () => {
    expect(extractImageUrls("https://a.png")).toEqual(["https://a.png"]);
    expect(extractImageUrls(["https://a.png", "https://b.png"])).toEqual(["https://a.png", "https://b.png"]);
    expect(extractImageUrls([["https://a.png"], "https://b.png"])).toEqual(["https://a.png", "https://b.png"]);
    expect(extractImageUrls(null)).toEqual([]);
    expect(extractImageUrls(42)).toEqual([]);
  });
});

describe("friendlyProviderError", () => {
  it("maps 429 / rate-limit errors to a friendly retry message", () => {
    const friendly = "Replicate rate limit hit. Wait a minute or add credit, then retry.";
    expect(friendlyProviderError("Replicate request failed (429): rate limit reduced to 6 requests per minute")).toBe(friendly);
    expect(friendlyProviderError("429 Too Many Requests")).toBe(friendly);
    expect(friendlyProviderError("rate limit exceeded")).toBe(friendly);
  });

  it("passes other provider errors through unchanged (does not hide them)", () => {
    expect(friendlyProviderError("Replicate request failed (422): invalid input")).toBe("Replicate request failed (422): invalid input");
  });
});

describe("runReplicate", () => {
  it("dry-run returns no images and never calls the transport", async () => {
    const transport = vi.fn();
    const result = await runReplicate(
      { prompt: "p", negativePrompt: "n", count: 1, model: "m" },
      { dryRun: true, transport: transport as unknown as ReplicateTransport, config },
    );
    expect(result.imageUrls).toEqual([]);
    expect(transport).not.toHaveBeenCalled();
  });

  it("throws a friendly error when the token is missing", async () => {
    delete process.env.REPLICATE_API_TOKEN;
    expect(isReplicateConfigured()).toBe(false);
    await expect(
      runReplicate({ prompt: "p", negativePrompt: "n", count: 1, model: "m" }, { dryRun: false, config }),
    ).rejects.toThrow(/REPLICATE_API_TOKEN/);
  });

  it("returns image urls from a mocked successful prediction", async () => {
    process.env.REPLICATE_API_TOKEN = "r8_test";
    const transport: ReplicateTransport = async () =>
      fakeRes({ status: "succeeded", output: ["https://img/1.png", "https://img/2.png"] });
    const result = await runReplicate(
      { prompt: "p", negativePrompt: "n", count: 2, model: "m" },
      { dryRun: false, transport, config },
    );
    expect(result.imageUrls).toEqual(["https://img/1.png", "https://img/2.png"]);
  });

  it("retries on transport failure then throws", async () => {
    process.env.REPLICATE_API_TOKEN = "r8_test";
    const transport = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(
      runReplicate({ prompt: "p", negativePrompt: "n", count: 1, model: "m" }, { dryRun: false, transport: transport as unknown as ReplicateTransport, config }),
    ).rejects.toThrow(/network down/);
    expect(transport).toHaveBeenCalledTimes(config.retryLimit + 1);
  });

  it("surfaces a failed prediction status", async () => {
    process.env.REPLICATE_API_TOKEN = "r8_test";
    const transport: ReplicateTransport = async () => fakeRes({ status: "failed", error: "nsfw filtered" });
    await expect(
      runReplicate({ prompt: "p", negativePrompt: "n", count: 1, model: "m" }, { dryRun: false, transport, config, }),
    ).rejects.toThrow(/nsfw filtered/);
  });
});
