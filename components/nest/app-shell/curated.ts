import { encodeDoc } from "@/lib/nest-document-store";
import type { NestDocument } from "@/lib/nest-document-types";
import type { ProductionTemplate } from "@/lib/nest-production-types";

// A curated production template rendered as a shareable example Nest. Both Home
// (discovery feed) and Explore (search/trending) show these — opened as real visitor
// Nests via the self-contained `?c=` link (works with no backend). Shared so the two
// screens stay consistent.
export function templateToExample(t: ProductionTemplate): { doc: NestDocument; href: string; tpl: ProductionTemplate } {
  const doc: NestDocument = {
    id: `example-${t.id}`,
    backgroundId: t.backgroundId,
    title: t.name,
    visibility: "public",
    placements: t.objectPlacements.map((p, i) => ({ id: `pl-${i}`, ...p })),
    createdAt: "",
    updatedAt: "",
    sourceTemplateId: t.id,
  };
  return { doc, href: `/nest/${t.id}?c=${encodeDoc(doc)}`, tpl: t };
}
