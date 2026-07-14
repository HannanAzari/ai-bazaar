/**
 * lib/ai/provider.ts — provider registry + selection.
 * -----------------------------------------------------------------------------
 * The engine asks here for a backend; it never imports a concrete provider. This
 * is the seam where "Canvas stub today, hosted model tomorrow" happens without any
 * studio or UI change. Default is the stub (works with no key); a configured
 * hosted provider can be registered and selected by id or env.
 */

import type { AIImageProvider } from "./types";
import { stubProvider } from "./providers/stub";

const registry = new Map<string, AIImageProvider>();
registry.set(stubProvider.id, stubProvider);

let defaultProviderId = stubProvider.id;

/** Register (or replace) a provider. Hosted providers call this from server code. */
export function registerProvider(provider: AIImageProvider, makeDefault = false): void {
  registry.set(provider.id, provider);
  if (makeDefault) defaultProviderId = provider.id;
}

export function setDefaultProvider(id: string): void {
  if (!registry.has(id)) throw new Error(`Unknown AI provider: ${id}`);
  defaultProviderId = id;
}

export function listProviders(): AIImageProvider[] {
  return Array.from(registry.values());
}

/** Resolve a provider by id (or the configured default). Throws if unknown. */
export function getProvider(id?: string): AIImageProvider {
  const key = id ?? defaultProviderId;
  const provider = registry.get(key);
  if (!provider) throw new Error(`Unknown AI provider: ${key}`);
  return provider;
}
