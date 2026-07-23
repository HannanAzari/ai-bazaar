import type { AvatarSpec } from "@/lib/avatar-factory/translator";
import { compileAvatarPrompt } from "@/lib/art-engine/compiler";

// ── Avatar DNA — SUBJECT clauses only; the shared world + type style come from the Art
// Engine compiler (lib/art-engine). No visual-style prose lives here anymore — change the
// look in lib/visual-dna (shared) or lib/art-engine/type-dna (avatar-specific).

// Portrait, cover-fit into the editor. Full-body figures read best tall.
export const AVATAR_GEN_SIZE = "1024x1536";
export const AVATAR_DNA_VERSION = "avatar-dna-v1";

export function buildAvatarPrompt(spec: AvatarSpec): { positive: string; negative: string } {
  const accessories = spec.accessories.filter(Boolean).join(", ");
  // styleIntensity nudges how far from photo → stylised, without changing identity.
  const intensity =
    spec.styleIntensity === "subtle" ? "keep stylisation gentle — very close to the real person, just softened and sculpted"
    : spec.styleIntensity === "stylised" ? "push the premium 3D stylisation further while keeping a clear likeness"
    : "balanced premium 3D stylisation with a clear likeness";
  // SUBJECT-specific clauses only. Identity preservation is the avatar's core subject rule.
  const subject = [
    `${intensity}.`,
    "IDENTITY: use the uploaded photo as the identity source, not mere inspiration. Preserve the person's face shape, hairstyle, hair colour, visible glasses/accessories, facial hair as-is, general expression, skin appearance and body type. Do NOT change apparent gender presentation, do NOT remove glasses, do NOT invent facial hair, do NOT swap the hairstyle for a generic one, do NOT alter skin tone.",
    `Outfit: ${spec.outfitCategory} in ${spec.clothingPalette}. Hair: ${spec.hair}. Expression: ${spec.expression}.`,
    `Body proportion family: ${spec.bodyProportionFamily}. Pose: idle standing, arms relaxed at the sides.`,
    accessories ? `Keep these visible accessories: ${accessories}.` : "",
    spec.generationSubject ? `Neutral description: ${spec.generationSubject}.` : "",
  ];
  const compiled = compileAvatarPrompt(subject);
  return { positive: compiled.positive, negative: compiled.negative };
}

// Words that would signal a sensitive-attribute leak into the neutral description.
const SENSITIVE_LEAK = /\b(ethnic|race|racial|nationality|religio|christian|muslim|jewish|hindu|buddhist|gay|lesbian|straight|sexual|disab|wheelchair|liberal|conservative|republican|democrat|wealthy|poor|age\s*\d|years?\s*old|\b\d{1,2}\s*yo\b)/i;

export function scoreAvatarDna(spec: AvatarSpec): { score: number; checks: { label: string; ok: boolean }[] } {
  const subject = `${spec.generationSubject} ${spec.hair} ${spec.outfitCategory} ${spec.accessories.join(" ")}`;
  const checks = [
    { label: "Idle-standing pose", ok: spec.canonicalPose === "idle-standing" },
    { label: "Transparent + full-body", ok: spec.transparency === true },
    { label: "Private (owner-scoped)", ok: spec.privacyScope === "private-user" },
    { label: "No sensitive attributes", ok: !SENSITIVE_LEAK.test(subject) },
    { label: "Safe", ok: spec.moderation.ok !== false },
  ];
  const score = checks.filter((c) => c.ok).length / checks.length;
  return { score: Math.round(score * 100) / 100, checks };
}
