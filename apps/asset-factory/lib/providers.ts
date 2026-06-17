// Client-safe provider metadata (V3.3). No server imports, no secrets — safe to
// import in client components AND server code. The server-only runners live in
// lib/image-provider.ts (Replicate/OpenAI clients).

export type ProviderId = "replicate" | "openai";

export const PROVIDERS: { id: ProviderId; label: string; blurb: string }[] = [
  { id: "replicate", label: "Replicate (FLUX)", blurb: "FLUX Schnell/Pro — fast, cheap; tends to add platforms/scenes." },
  { id: "openai", label: "OpenAI (GPT Image)", blurb: "GPT Image — cleaner objects/transparency; higher cost." },
];

export const PROVIDER_IDS: ProviderId[] = PROVIDERS.map((p) => p.id);

export function isProvider(value: string): value is ProviderId {
  return value === "replicate" || value === "openai";
}

export function providerLabel(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.label ?? id;
}
