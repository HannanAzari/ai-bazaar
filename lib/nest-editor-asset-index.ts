// ── Nestudio V2 — Nest Editor asset index (M7A) ─────────────────────────────
//
// Pure, framework-free data architecture for the asset keyboard/drawer: a category
// TREE (with child categories) kept out of any component, a deterministic
// classifier (asset → category + child), client-side search (name / category / tag /
// child / interaction capability), and namespaced Recent + Favourites persistence
// behind the injectable StorageLike. No I/O coupling, no Math.random, no Date.now.

import type { LivingNestAsset, LivingNestSlotType } from "@/lib/nest-visual-types";
import type { StorageLike } from "@/lib/nest-editor-storage";

export interface AssetCategoryNode {
  id: string;
  label: string;
  children?: AssetCategoryNode[];
}

/**
 * The category tree shown as tabs. `all/recent/favourites/animated` are virtual
 * (computed) categories; the rest map to asset categories with optional children.
 * Declared as data so the drawer never hardcodes the taxonomy.
 */
export const ASSET_CATEGORY_TREE: AssetCategoryNode[] = [
  { id: "all", label: "All" },
  { id: "recent", label: "Recent" },
  { id: "favourites", label: "Favourites" },
  {
    id: "seating",
    label: "Seating",
    children: [
      { id: "sofas", label: "Sofas" },
      { id: "armchairs", label: "Armchairs" },
      { id: "stools", label: "Stools" },
    ],
  },
  {
    id: "tables",
    label: "Tables",
    children: [
      { id: "coffee-tables", label: "Coffee" },
      { id: "side-tables", label: "Side" },
      { id: "desks", label: "Desks" },
    ],
  },
  { id: "media", label: "Media" },
  { id: "lighting", label: "Lighting" },
  { id: "plants", label: "Plants" },
  { id: "decor", label: "Decor" },
  { id: "avatars", label: "Avatars" },
  { id: "floor", label: "Floor" },
  { id: "animated", label: "Animated" },
];

export interface AssetClassification {
  category: string;
  childCategory?: string;
}

/** Deterministically classify an asset into a top category + child category. */
export function classifyAsset(asset: LivingNestAsset): AssetClassification {
  const st: LivingNestSlotType | undefined = asset.compatibleSlotTypes[0];
  switch (st) {
    case "sofa":
      return { category: "seating", childCategory: "sofas" };
    case "table":
      return { category: "tables", childCategory: "coffee-tables" };
    case "side_table":
      return { category: "tables", childCategory: "side-tables" };
    case "desk":
      return { category: "tables", childCategory: "desks" };
    case "media":
      return { category: "media" };
    case "lamp":
      return { category: "lighting" };
    case "plant":
      return { category: "plants" };
    case "rug":
      return { category: "floor" };
    case "avatar":
      return { category: "avatars" };
    case "frame":
    case "books":
    case "shelf":
    default:
      return { category: "decor" };
  }
}

/** Whether an asset animates / is interactive (the "Animated" virtual category). */
export function isAnimatedAsset(asset: LivingNestAsset): boolean {
  return Boolean(asset.defaultInteractionId) || Boolean(asset.statePack?.active || asset.statePack?.layers?.length);
}

export interface CategoryContext {
  recentIds?: string[];
  favouriteIds?: string[];
}

/** Whether an asset belongs in a category tab (handles virtual categories). */
export function assetInCategory(asset: LivingNestAsset, categoryId: string, ctx: CategoryContext = {}): boolean {
  if (categoryId === "all") return true;
  if (categoryId === "recent") return (ctx.recentIds ?? []).includes(asset.id);
  if (categoryId === "favourites") return (ctx.favouriteIds ?? []).includes(asset.id);
  if (categoryId === "animated") return isAnimatedAsset(asset);
  const c = classifyAsset(asset);
  return c.category === categoryId || c.childCategory === categoryId;
}

const lc = (s: string) => s.toLowerCase();

/**
 * Client-side search over the catalog: matches name, category label, child category,
 * tags, slot type, and an "interactive/animated" capability term. Deterministic
 * (stable order by id).
 */
export function searchAssets(assets: LivingNestAsset[], query: string): LivingNestAsset[] {
  const q = lc(query.trim());
  if (!q) return [...assets].sort((a, b) => (a.id < b.id ? -1 : 1));
  return assets
    .filter((a) => {
      const c = classifyAsset(a);
      const hay = [
        a.name,
        a.id,
        c.category,
        c.childCategory ?? "",
        ...a.tags,
        ...a.compatibleSlotTypes,
        isAnimatedAsset(a) ? "animated interactive" : "",
      ]
        .map(lc)
        .join(" ");
      return hay.includes(q);
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

// ── Recent + Favourites persistence (namespaced, injectable, deterministic) ──

const NS = "nestudio:nest-editor:v1";
export const RECENT_KEY = `${NS}:recent`;
export const FAVOURITES_KEY = `${NS}:favourites`;
export const MAX_RECENT = 12;

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* unavailable */
  }
  return null;
}

function readIds(key: string, storage: StorageLike | null): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[], storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(ids));
  } catch {
    /* ignore quota/privacy errors */
  }
}

/** Most-recent-first list of recently added asset ids. */
export function getRecent(storage: StorageLike | null = defaultStorage()): string[] {
  return readIds(RECENT_KEY, storage);
}

/** Record an asset as recently used (dedup, most-recent-first, capped). Pure-ish. */
export function pushRecent(assetId: string, storage: StorageLike | null = defaultStorage()): string[] {
  const current = readIds(RECENT_KEY, storage).filter((id) => id !== assetId);
  const next = [assetId, ...current].slice(0, MAX_RECENT);
  writeIds(RECENT_KEY, next, storage);
  return next;
}

/** Apply the recent-update rule to an existing list (pure, for tests). */
export function applyRecent(current: string[], assetId: string): string[] {
  return [assetId, ...current.filter((id) => id !== assetId)].slice(0, MAX_RECENT);
}

export function getFavourites(storage: StorageLike | null = defaultStorage()): string[] {
  return readIds(FAVOURITES_KEY, storage);
}

export function isFavourite(assetId: string, storage: StorageLike | null = defaultStorage()): boolean {
  return readIds(FAVOURITES_KEY, storage).includes(assetId);
}

/** Toggle a favourite; returns the new favourites list. */
export function toggleFavourite(assetId: string, storage: StorageLike | null = defaultStorage()): string[] {
  const current = readIds(FAVOURITES_KEY, storage);
  const next = current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId];
  writeIds(FAVOURITES_KEY, next, storage);
  return next;
}
