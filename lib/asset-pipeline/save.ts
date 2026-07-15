/**
 * lib/asset-pipeline/save.ts — turn a chosen candidate into a savable inventory
 * record. Keeps the editor flow thin: the pipeline produces candidates; this maps
 * the one the human picked into the existing InventoryAsset contract (so it flows
 * straight into the editor tray via the M20 bridge — no new plumbing).
 */

import type { AssembledPrompt } from "@/lib/ai/types";
import { NESTUDIO_STYLE } from "@/lib/ai/style";
import { buildAssetDnaPrompt } from "@/lib/asset-dna";
import type { InventoryAsset } from "@/lib/ai-inventory/types";
import type { AssetCandidate } from "./types";

function titleFor(subject: string): string {
  const s = subject.trim() || "Object";
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function idFor(): string {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(Date.now() % 1e9).toString(36);
  return `ai_${Date.now().toString(36)}_${rand}`;
}

/** Compose a valid InventoryAsset from a chosen candidate. `now`/`id` injectable. */
export function inventoryAssetFromCandidate(
  candidate: AssetCandidate,
  opts: { subject: string; notes?: string; now?: () => string; id?: () => string } = { subject: "object" },
): InventoryAsset {
  const subject = (opts.subject || "object").trim();
  const dnaPrompt = buildAssetDnaPrompt(subject, opts.notes);
  const tags = Array.from(
    new Set(["ai", candidate.provider, ...subject.toLowerCase().split(/\s+/).filter(Boolean)]),
  );
  const prompt: AssembledPrompt = {
    kind: "furniture",
    subject,
    positive: dnaPrompt.positive,
    negative: dnaPrompt.negative,
    style: NESTUDIO_STYLE,
    tags,
    params: { size: candidate.image.width, dnaVersion: candidate.dnaVersion },
    promptVersion: candidate.dnaVersion,
  };
  const id = (opts.id ?? idFor)();
  const createdAt = (opts.now ?? (() => new Date().toISOString()))();
  return {
    id,
    kind: "furniture",
    name: titleFor(subject),
    tags,
    imageUrl: candidate.image.dataUrl,
    width: candidate.image.width,
    height: candidate.image.height,
    createdAt,
    publishTarget: "inventory",
    reviewStatus: "approved",
    metadata: {
      id,
      kind: "furniture",
      name: titleFor(subject),
      subject,
      prompt,
      provider: candidate.provider,
      source: { width: candidate.image.width, height: candidate.image.height },
      output: { width: candidate.image.width, height: candidate.image.height },
      createdAt,
      pipeline: ["cutout", "generate", "finish"],
      version: 1,
      promptVersion: candidate.dnaVersion,
    },
  };
}
