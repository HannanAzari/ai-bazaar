import { describe, it, expect, afterEach, vi } from "vitest";
import {
  extractOpenAiImages,
  runOpenAi,
  isOpenAiConfigured,
  friendlyOpenAiError,
  type OpenAiTransport,
} from "@/lib/openai-server";
import { getGenerationConfig } from "@/lib/generation-config";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
});

function fakeRes(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

const config = { ...getGenerationConfig(), timeoutMs: 2000, retryLimit: 1 };

describe("openai output parsing", () => {
  it("prefers base64, falls back to url, ignores junk", () => {
    expect(extractOpenAiImages({ data: [{ b64_json: "AAAA" }] })).toEqual([{ b64: "AAAA", contentType: "image/png" }]);
    expect(extractOpenAiImages({ data: [{ url: "https://x/a.png" }] })).toEqual([{ url: "https://x/a.png" }]);
    expect(extractOpenAiImages({ data: [{}, { b64_json: "" }] })).toEqual([]);
    expect(extractOpenAiImages(null)).toEqual([]);
  });
});

describe("friendlyOpenAiError", () => {
  it("maps the documented failure modes; passes others through", () => {
    expect(friendlyOpenAiError("OpenAI request failed (429): rate limit")).toBe("OpenAI rate limit hit. Wait a minute, then retry.");
    expect(friendlyOpenAiError("insufficient_quota: you exceeded your current quota")).toBe("OpenAI quota exceeded — add credit, then retry.");
    expect(friendlyOpenAiError("The model gpt-image-9 does not exist")).toBe("Invalid OpenAI image model — check OPENAI_IMAGE_MODEL.");
    expect(friendlyOpenAiError("Your request was rejected by the safety system")).toBe("OpenAI rejected the prompt as unsafe. Adjust the asset idea.");
    expect(friendlyOpenAiError("Incorrect API key provided (401)")).toBe("OpenAI API key is missing or invalid. Set OPENAI_API_KEY.");
    expect(friendlyOpenAiError("some unexpected explosion")).toBe("some unexpected explosion");
  });
});

describe("runOpenAi", () => {
  it("dry-run returns no images and never calls the transport", async () => {
    const transport = vi.fn();
    const r = await runOpenAi({ prompt: "p", negativePrompt: "n", count: 1, model: "gpt-image-1" }, { dryRun: true, transport: transport as unknown as OpenAiTransport, config });
    expect(r.images).toEqual([]);
    expect(transport).not.toHaveBeenCalled();
  });

  it("throws a friendly error when the key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    expect(isOpenAiConfigured()).toBe(false);
    await expect(
      runOpenAi({ prompt: "p", negativePrompt: "n", count: 1, model: "gpt-image-1" }, { dryRun: false, config }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("returns base64 images from a mocked success and requests transparency", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    let sentBody: Record<string, unknown> = {};
    const transport: OpenAiTransport = async (_url, init) => {
      sentBody = JSON.parse(String(init.body));
      return fakeRes({ data: [{ b64_json: "AAAA" }, { b64_json: "BBBB" }] });
    };
    const r = await runOpenAi({ prompt: "a chair", negativePrompt: "no scene", count: 2, model: "gpt-image-1", transparent: true }, { dryRun: false, transport, config });
    expect(r.images).toEqual([{ b64: "AAAA", contentType: "image/png" }, { b64: "BBBB", contentType: "image/png" }]);
    expect(sentBody.size).toBe("1024x1024");
    expect(sentBody.background).toBe("transparent");
    expect(sentBody.n).toBe(2);
    // negative prompt folded into the prompt (OpenAI has no negative param)
    expect(String(sentBody.prompt)).toContain("Avoid: no scene");
  });

  it("surfaces a mocked failure (quota) without retrying it", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const transport = vi.fn(async () => fakeRes({ error: { message: "insufficient_quota" } }, false, 429));
    await expect(
      runOpenAi({ prompt: "p", negativePrompt: "n", count: 1, model: "gpt-image-1" }, { dryRun: false, transport: transport as unknown as OpenAiTransport, config }),
    ).rejects.toThrow(/insufficient_quota|429/);
    expect(transport).toHaveBeenCalledTimes(1); // quota errors are not retried
  });
});
