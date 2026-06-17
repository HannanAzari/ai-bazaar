// Server-only Replicate client (V3, Task 2). Uses the REST API via fetch — no SDK
// dependency, no client import. The token is a non-public env var, so it is never
// inlined into client bundles. Supports a dry-run (no network) and an injectable
// transport so tests can supply a mocked response.
//
// NEVER import this from a client component.

import { type GenerationConfig } from "@/lib/generation-config";

const REPLICATE_API = "https://api.replicate.com/v1";

export function getReplicateToken(): string | null {
  return process.env.REPLICATE_API_TOKEN || null;
}

export function isReplicateConfigured(): boolean {
  return !!getReplicateToken();
}

export function replicateConfigError(): string {
  return "Replicate is not configured. Set REPLICATE_API_TOKEN (server-only).";
}

/**
 * Map a raw provider error to a friendly, user-facing message WITHOUT hiding it:
 * rate-limit (429) errors get clear guidance; everything else is returned as-is so
 * the real provider error still surfaces.
 */
export function friendlyProviderError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("429") || m.includes("rate limit") || m.includes("too many requests")) {
    return "Replicate rate limit hit. Wait a minute or add credit, then retry.";
  }
  return message;
}

export type ReplicateRunInput = {
  prompt: string;
  negativePrompt: string;
  count: number;
  model: string;
};

export type ReplicateResult = {
  imageUrls: string[];
  /** Raw provider payload (kept for debugging/cost). */
  raw?: unknown;
};

/** Minimal fetch signature so tests can inject a mock. */
export type ReplicateTransport = (url: string, init: RequestInit) => Promise<Response>;

export type RunOptions = {
  dryRun?: boolean;
  transport?: ReplicateTransport;
  config: GenerationConfig;
};

/** Normalize a prediction's `output` (string | string[] | nested) to image urls. */
export function extractImageUrls(output: unknown): string[] {
  if (!output) return [];
  if (typeof output === "string") return [output];
  if (Array.isArray(output)) {
    return output.flatMap(extractImageUrls).filter((u): u is string => typeof u === "string");
  }
  return [];
}

type Prediction = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: string | null;
  urls?: { get?: string };
};

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function createPrediction(input: ReplicateRunInput, token: string, transport: ReplicateTransport, signal: AbortSignal): Promise<Prediction> {
  const res = await transport(`${REPLICATE_API}/models/${input.model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    signal,
    body: JSON.stringify({
      input: {
        prompt: input.prompt,
        num_outputs: input.count,
        aspect_ratio: "1:1",
        output_format: "png",
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Replicate request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as Prediction;
}

async function pollPrediction(getUrl: string, token: string, transport: ReplicateTransport, signal: AbortSignal): Promise<Prediction> {
  // Up to ~20 polls; the create call used Prefer: wait so this is usually skipped.
  for (let i = 0; i < 20; i += 1) {
    const res = await transport(getUrl, { headers: { Authorization: `Bearer ${token}` }, signal });
    const pred = (await res.json()) as Prediction;
    if (pred.status === "succeeded" || pred.status === "failed" || pred.status === "canceled") return pred;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Replicate prediction timed out.");
}

/**
 * Run a generation. Dry-run returns no images and never touches the network.
 * Real runs require a token and call Replicate, with one retry on transport error.
 */
export async function runReplicate(input: ReplicateRunInput, options: RunOptions): Promise<ReplicateResult> {
  if (options.dryRun) return { imageUrls: [] };

  const token = getReplicateToken();
  if (!token) throw new Error(replicateConfigError());

  const transport = options.transport ?? ((url, init) => fetch(url, init));
  const { timeoutMs, retryLimit } = options.config;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
    try {
      return await withTimeout(async (signal) => {
        let pred = await createPrediction(input, token, transport, signal);
        if (!pred.output && pred.status !== "succeeded" && pred.urls?.get) {
          pred = await pollPrediction(pred.urls.get, token, transport, signal);
        }
        if (pred.status === "failed" || pred.status === "canceled") {
          throw new Error(pred.error || `Replicate prediction ${pred.status}.`);
        }
        const imageUrls = extractImageUrls(pred.output);
        return { imageUrls, raw: pred };
      }, timeoutMs);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Replicate generation failed.");
}
