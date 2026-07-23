// ── Art Engine — Golden References ────────────────────────────────────────────
//
// Five permanent regression references for the Art Engine. Each is VERSIONED against the
// engine (Visual DNA + Type DNA + compiler + camera) so a future engine change can be
// compared before it reaches production. Slots start `pending`; the founder fills
// `outputUrl` + flips to `approved` after the calibration review. Never replace an approved
// Golden Reference silently — add a new version.

import { VISUAL_DNA_VERSION } from "@/lib/visual-dna";
import { PROMPT_COMPILER_VERSION } from "@/lib/art-engine/compiler";
import { TYPE_DNA, type ArtType } from "@/lib/art-engine/type-dna";

export type GoldenReference = {
  id: string;
  label: string;
  type: ArtType;
  visualDnaVersion: string;
  typeDnaVersion: string;
  compilerVersion: string;
  camera: string;
  sourceUrl: string | null; // reference/source (private for avatars)
  outputUrl: string | null; // founder-approved final output
  metadata: Record<string, unknown>;
  approval: "pending" | "approved";
  approvedAt: string | null;
};

function slot(id: string, label: string, type: ArtType): GoldenReference {
  return {
    id, label, type,
    visualDnaVersion: VISUAL_DNA_VERSION,
    typeDnaVersion: TYPE_DNA[type].version,
    compilerVersion: PROMPT_COMPILER_VERSION,
    camera: TYPE_DNA[type].camera,
    sourceUrl: null, outputUrl: null, metadata: {}, approval: "pending", approvedAt: null,
  };
}

export const GOLDEN_REFERENCES: GoldenReference[] = [
  slot("golden-avatar-idle", "Avatar — Idle Standing", "avatar"),
  slot("golden-asset-object", "Asset — Laptop / Guitar", "asset"),
  slot("golden-asset-seat", "Asset — Sofa / Chair", "asset"),
  slot("golden-nest-minimal", "Empty Nest — Minimal", "nest"),
  slot("golden-nest-studio", "Empty Nest — Creator Studio", "nest"),
];

export function goldenReference(id: string): GoldenReference | undefined {
  return GOLDEN_REFERENCES.find((g) => g.id === id);
}
export function goldenApprovalSummary(): { total: number; approved: number; pending: number } {
  const approved = GOLDEN_REFERENCES.filter((g) => g.approval === "approved").length;
  return { total: GOLDEN_REFERENCES.length, approved, pending: GOLDEN_REFERENCES.length - approved };
}
