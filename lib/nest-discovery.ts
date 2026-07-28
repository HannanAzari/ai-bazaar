// ── M17 — Discovery model ─────────────────────────────────────────────────────
//
// A lightweight, backend-free discovery layer. It unifies the two sources we already
// have — a creator's **published** Nests and the **curated** example Nests (templates) —
// into one `DiscoveryItem` shape that Home (the feed) and Explore (search) both render.
// No recommendation engine, no social graph — just "here are Nests to wander into."

import { encodeDoc } from "@/lib/nest-document-store";
import type { NestDocument, NestVisibility } from "@/lib/nest-document-types";
import type { ProductionTemplate } from "@/lib/nest-production-types";

export type DiscoverySource = "published" | "curated" | "demo";
export type DiscoveryCreator = {
  id?: string;
  username?: string;
  displayName?: string;
  /** M23B — the creator's CHOSEN house (`profiles.house_style`), so the Village and the
   *  arrival screen show the house they picked in onboarding, not one derived from a
   *  Nest's persona. */
  houseStyle?: string;
};

export type DiscoveryItem = {
  /** Stable React key. */
  key: string;
  /** Nest slug (published) or example id (curated). */
  id: string;
  title: string;
  creator: DiscoveryCreator;
  /** The composed document (background + placements) so cards can render the REAL Nest. */
  doc: NestDocument;
  tags: string[];
  /** Persona / theme (e.g. "Creator", "Gamer"). */
  category?: string;
  visibility: NestVisibility;
  source: DiscoverySource;
  /** Route that opens the Nest. */
  href: string;
};

/** A curated template rendered as a shareable example Nest (self-contained `?c=` link). */
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

/** Build discovery items for the curated example Nests. */
export function curatedItems(templates: ProductionTemplate[]): DiscoveryItem[] {
  return templates.map((t) => {
    const { href, doc } = templateToExample(t);
    return {
      key: `ex-${t.id}`,
      id: t.id,
      title: t.name,
      creator: { displayName: "Nestudio" },
      doc,
      tags: t.tags ?? [],
      category: t.persona,
      visibility: "public" as const,
      source: "curated" as const,
      href,
    };
  });
}

/** Build a discovery item from a published Nest (creator/tags resolved by the caller). */
export function publishedItem(input: {
  slug: string;
  title: string;
  visibility: NestVisibility;
  href: string;
  creator: DiscoveryCreator;
  doc: NestDocument;
  tags?: string[];
  category?: string;
}): DiscoveryItem {
  return {
    key: `pub-${input.slug}`,
    id: input.slug,
    title: input.title,
    creator: input.creator,
    doc: input.doc,
    tags: input.tags ?? [],
    category: input.category,
    visibility: input.visibility,
    source: "published",
    href: input.href,
  };
}

// ── Search + filter ────────────────────────────────────────────────────────────

/** A human label for a creator: @username, else display name, else a friendly default. */
export function creatorLabel(creator: DiscoveryCreator): string {
  if (creator.username) return `@${creator.username}`;
  if (creator.displayName) return creator.displayName;
  return "A Nestudio creator";
}

/** Free-text search across title, creator (username + display name), tags, and category. */
export function searchDiscovery(items: DiscoveryItem[], query: string): DiscoveryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) => {
    const haystack = [
      it.title,
      it.creator.username ?? "",
      it.creator.displayName ?? "",
      it.category ?? "",
      ...it.tags,
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

/** Items carrying a given tag (case-insensitive). */
export function filterByTag(items: DiscoveryItem[], tag: string): DiscoveryItem[] {
  const t = tag.trim().toLowerCase();
  if (!t) return items;
  return items.filter((it) => it.tags.some((x) => x.toLowerCase() === t));
}

/** Unique tags across items, most-common first (a stand-in for real trending). */
export function collectTags(items: DiscoveryItem[], limit = 12): string[] {
  const counts = new Map<string, number>();
  items.forEach((it) => it.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

/** Unique categories (personas) across items, in first-seen order. */
export function collectCategories(items: DiscoveryItem[]): string[] {
  const seen: string[] = [];
  for (const it of items) if (it.category && !seen.includes(it.category)) seen.push(it.category);
  return seen;
}
