// Server-only OpenAI image client (V3.3). Uses the official Images API via fetch —
// no SDK dependency, no client import. The key is a non-public env var, never
// inlined into client bundles. Supports a dry-run (no network) and an injectable
// transport so tests can supply a mocked response. GPT Image returns base64 bytes,
// which the caller stores via the existing upload/storage flow.
//
// NEVER import this from a client component.

import { type GenerationConfig } from "@/lib/generation-config";

const OPENAI_API = "https://api.openai.com/v1";

export function getOpenAiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

export function isOpenAiConfigured(): boolean {
  return !!getOpenAiKey();
}

export function openAiConfigError(): string {
  return "OpenAI API key is missing. Set OPENAI_API_KEY (server-only).";
}

/** Map a raw OpenAI error to a friendly message WITHOUT hiding non-mapped errors. */
export function friendlyOpenAiError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("api key") || m.includes("not configured") || m.includes("incorrect api key") || m.includes("401")) {
    return "OpenAI API key is missing or invalid. Set OPENAI_API_KEY.";
  }
  if (m.includes("insufficient_quota") || m.includes("quota") || m.includes("billing") || m.includes("exceeded your current quota")) {
    return "OpenAI quota exceeded — add credit, then retry.";
  }
  if (m.includes("model_not_found") || m.includes("does not exist") || m.includes("invalid model") || m.includes("unknown model")) {
    return "Invalid OpenAI image model — check OPENAI_IMAGE_MODEL.";
  }
  if (m.includes("429") || m.includes("rate limit") || m.includes("too many requests")) {
    return "OpenAI rate limit hit. Wait a minute, then retry.";
  }
  if (m.includes("safety") || m.includes("moderation") || m.includes("content policy") || m.includes("rejected") || m.includes("not allowed")) {
    return "OpenAI rejected the prompt as unsafe. Adjust the asset idea.";
  }
  return message;
}

export type OpenAiImage = { b64?: string; url?: string; contentType?: string };
export type OpenAiResult = { images: OpenAiImage[]; raw?: unknown };

export type OpenAiTransport = (url: string, init: RequestInit) => Promise<Response>;

export type OpenAiRunInput = {
  prompt: string;
  negativePrompt: string;
  count: number;
  model: string;
  /** Request a transparent background when the model supports it. */
  transparent?: boolean;
  /** Image size, e.g. "1024x1024" (default) or "1024x1536" (portrait). Additive. */
  size?: string;
};

export type OpenAiRunOptions = {
  dryRun?: boolean;
  transport?: OpenAiTransport;
  config: GenerationConfig;
};

/** Map the Images API `data[]` to our normalized image shape (prefers base64). */
export function extractOpenAiImages(data: unknown): OpenAiImage[] {
  const arr = (data as { data?: unknown[] })?.data;
  if (!Array.isArray(arr)) return [];
  const out: OpenAiImage[] = [];
  for (const d of arr) {
    const item = d as { b64_json?: string; url?: string };
    if (typeof item.b64_json === "string" && item.b64_json) out.push({ b64: item.b64_json, contentType: "image/png" });
    else if (typeof item.url === "string" && item.url) out.push({ url: item.url });
  }
  return out;
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate images with OpenAI. Dry-run returns no images and never touches the
 * network. OpenAI has no negative-prompt field, so it is folded into the prompt.
 * GPT Image returns base64 PNG; transparency is requested via `background`.
 */
export async function runOpenAi(input: OpenAiRunInput, options: OpenAiRunOptions): Promise<OpenAiResult> {
  if (options.dryRun) return { images: [] };

  const key = getOpenAiKey();
  if (!key) throw new Error(openAiConfigError());

  const transport = options.transport ?? ((url, init) => fetch(url, init));
  const { timeoutMs, retryLimit } = options.config;

  const prompt = input.negativePrompt ? `${input.prompt}. Avoid: ${input.negativePrompt}.` : input.prompt;
  const body: Record<string, unknown> = {
    model: input.model,
    prompt,
    n: input.count,
    size: input.size ?? "1024x1024",
  };
  if (input.transparent) {
    body.background = "transparent";
    body.output_format = "png";
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
    try {
      return await withTimeout(async (signal) => {
        const res = await transport(`${OPENAI_API}/images/generations`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          signal,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`OpenAI request failed (${res.status}): ${text.slice(0, 300)}`);
        }
        const data = await res.json();
        return { images: extractOpenAiImages(data), raw: data };
      }, timeoutMs);
    } catch (err) {
      lastError = err;
      // Don't retry client errors that won't change (quota / invalid model / safety).
      const msg = (err instanceof Error ? err.message : "").toLowerCase();
      if (msg.includes("quota") || msg.includes("model_not_found") || msg.includes("invalid model") || msg.includes("safety") || msg.includes("content policy") || msg.includes("401")) {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("OpenAI generation failed.");
}
