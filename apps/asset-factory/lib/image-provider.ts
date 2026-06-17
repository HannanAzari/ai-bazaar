// Server-only provider abstraction (V3.3). Normalizes Replicate and OpenAI into one
// runner + result shape so the generation orchestration is provider-agnostic.
// Replicate returns hosted URLs; OpenAI returns base64 bytes — both collapse to
// `ProviderImage`, then `ImageStore` materializes a final URL (re-hosted in shared
// mode, or a data URL locally). NEVER import this from a client component.

import { type ProviderId } from "@/lib/providers";
import { type GenerationConfig } from "@/lib/generation-config";
import { runReplicate, friendlyProviderError as friendlyReplicate } from "@/lib/replicate-server";
import { runOpenAi, friendlyOpenAiError } from "@/lib/openai-server";

export type { ProviderId } from "@/lib/providers";

export type ProviderImage = { url?: string; b64?: string; contentType?: string };
export type ProviderResult = { images: ProviderImage[]; raw?: unknown };

export type ProviderRunInput = {
  prompt: string;
  negativePrompt: string;
  count: number;
  model: string;
  transparent?: boolean;
};

export type ProviderRunOptions = { dryRun?: boolean; config: GenerationConfig };
export type ProviderRunner = (input: ProviderRunInput, options: ProviderRunOptions) => Promise<ProviderResult>;

/** The real runner for a provider (tests inject their own instead). */
export function getProviderRunner(provider: ProviderId): ProviderRunner {
  if (provider === "openai") {
    return async (input, options) => {
      const r = await runOpenAi(
        { prompt: input.prompt, negativePrompt: input.negativePrompt, count: input.count, model: input.model, transparent: input.transparent },
        { dryRun: options.dryRun, config: options.config },
      );
      return { images: r.images, raw: r.raw };
    };
  }
  return async (input, options) => {
    const r = await runReplicate(
      { prompt: input.prompt, negativePrompt: input.negativePrompt, count: input.count, model: input.model },
      { dryRun: options.dryRun, config: options.config },
    );
    return { images: r.imageUrls.map((url) => ({ url })), raw: r.raw };
  };
}

/** Friendly, non-hidden error mapping per provider. */
export function friendlyProviderError(provider: ProviderId, message: string): string {
  return provider === "openai" ? friendlyOpenAiError(message) : friendlyReplicate(message);
}

/** Turns a provider image into a final, storable/displayable URL. */
export type ImageStore = (image: ProviderImage, name: string) => Promise<string | null>;

/**
 * Local store (demo mode): keep hosted URLs as-is; inline base64 as a data URL so
 * the browser can display + persist it without a bucket.
 */
export const localImageStore: ImageStore = async (image) => {
  if (image.url) return image.url;
  if (image.b64) return `data:${image.contentType ?? "image/png"};base64,${image.b64}`;
  return null;
};
