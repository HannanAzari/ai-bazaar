// ── Art Engine — Prompt Compiler ──────────────────────────────────────────────
//
// ONE base compiler turns the shared Visual DNA + a Type DNA + the subject into a final
// generation prompt. There is no visual-style prose duplicated across the Avatar/Asset/Nest
// modules — they all call the compiler, which reads the single lib/visual-dna source. Change
// a shared property in lib/visual-dna and every compiled prompt changes consistently.

import { VISUAL_DNA, VISUAL_DNA_NEGATIVE, visualDnaFragment, type VisualDNA } from "@/lib/visual-dna";
import { TYPE_DNA, type ArtType, type TypeDNA } from "@/lib/art-engine/type-dna";

export const PROMPT_COMPILER_VERSION = "art-engine-compiler-v1";

export type CompiledPrompt = {
  positive: string;
  negative: string;
  hardConstraints: string[];
  /** What a valid output must satisfy (feeds the validators + founder review). */
  validationExpectations: string[];
  meta: {
    visualDnaVersion: string;
    typeDnaVersion: string;
    compilerVersion: string;
    camera: string;
    artType: ArtType;
  };
};

/** The base compiler: Shared Visual DNA + Type DNA + subject clauses → CompiledPrompt. */
function compile(args: {
  type: ArtType;
  subjectClauses: string[]; // subject identity / material / architecture specifics
  extraNegative?: string[];
  dna?: VisualDNA;
}): CompiledPrompt {
  const dna = args.dna ?? VISUAL_DNA;
  const typeDna: TypeDNA = TYPE_DNA[args.type];
  const positive = [
    visualDnaFragment(dna), // the SHARED world — single-sourced
    ...typeDna.positive,
    ...args.subjectClauses.filter(Boolean),
    `Camera: ${typeDna.camera}.`,
    ...typeDna.hardConstraints,
  ].join(" ");
  const negative = Array.from(new Set([...VISUAL_DNA_NEGATIVE, ...typeDna.negative, ...(args.extraNegative ?? [])])).join(", ");
  return {
    positive,
    negative,
    hardConstraints: typeDna.hardConstraints,
    validationExpectations: [
      "warm soft lighting", "matte material response", "subtle ambient occlusion",
      "soft edges", "clear silhouette", "reads at thumbnail size", "premium cohesive feel",
      ...typeDna.hardConstraints,
    ],
    meta: {
      visualDnaVersion: dna.version,
      typeDnaVersion: typeDna.version,
      compilerVersion: PROMPT_COMPILER_VERSION,
      camera: typeDna.camera,
      artType: args.type,
    },
  };
}

export function compileAvatarPrompt(subjectClauses: string[], dna?: VisualDNA): CompiledPrompt {
  return compile({ type: "avatar", subjectClauses, dna });
}
export function compileAssetPrompt(subjectClauses: string[], dna?: VisualDNA): CompiledPrompt {
  return compile({ type: "asset", subjectClauses, dna });
}
export function compileNestPrompt(subjectClauses: string[], dna?: VisualDNA): CompiledPrompt {
  return compile({ type: "nest", subjectClauses, dna });
}
