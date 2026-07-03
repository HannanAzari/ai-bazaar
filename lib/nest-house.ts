// ── M19 — House model ─────────────────────────────────────────────────────────
//
// Between a Creator and their Nests sits a **House**: the creator's identity as a
// *place* you can arrive at, not a profile card you scroll past. A House is derived
// **deterministically** from the creator's persona + identity — no house editor yet
// (that's a later sprint), and nothing about it is stored: give it the same creator
// and you get the same cozy cottage every time (hydration-safe — no Math.random /
// Date.now). Houses are laid out into a Village by `lib/nest-village.ts`.
//
// This builds on the M17 discovery model (persona/tags already resolved per creator)
// and the ADR-027 vision `Village → House → Nest`. It does not touch identity, the
// editor, publishing, discovery, or social — it composes on top of them.

import type { DiscoveryCreator, DiscoveryItem } from "@/lib/nest-discovery";

// ── Style palettes (cozy, storybook — Animal Crossing / Ghibli, not metaverse) ──

export type HouseStyle = {
  key: string;
  label: string;
  /** Main house body. */
  wall: string;
  /** Shaded side of the body (the sliver that gives it depth). */
  wallShade: string;
  /** Roof face. */
  roof: string;
  roofShade: string;
  /** Front door. */
  door: string;
  /** Window frames / trim / accents. */
  trim: string;
  /** Warm light glowing from the windows. */
  glow: string;
  /** The little garden patch the house sits on. */
  ground: string;
};

// Keyed by a normalized persona. Every palette stays warm + inviting; even the
// "gamer" house is a cozy moody cottage, never RGB/voxel/neon.
export const HOUSE_STYLES: Record<string, HouseStyle> = {
  cottage: {
    key: "cottage", label: "Cottage",
    wall: "#f0dfbc", wallShade: "#d8c199",
    roof: "#a65b3f", roofShade: "#7d4530",
    door: "#8a5c3b", trim: "#5c3e26",
    glow: "#ffc55c", ground: "#93ac5f",
  },
  creator: {
    key: "creator", label: "Creator Loft",
    wall: "#ead6b6", wallShade: "#cdb389",
    roof: "#3d7068", roofShade: "#2c534d",
    door: "#a65b3f", trim: "#5c3e26",
    glow: "#e8a23c", ground: "#93ac5f",
  },
  gamer: {
    key: "gamer", label: "Gamer Hollow",
    wall: "#6e563f", wallShade: "#503c2a",
    roof: "#3d5c6b", roofShade: "#2a414d",
    door: "#e08f3f", trim: "#2a1c12",
    glow: "#ffc55c", ground: "#6e8a47",
  },
  writer: {
    key: "writer", label: "Writer's Nook",
    wall: "#c79a6a", wallShade: "#9d7247",
    roof: "#e08f3f", roofShade: "#b56a2c",
    door: "#5c3e26", trim: "#3a2a1a",
    glow: "#e8a23c", ground: "#93ac5f",
  },
  minimalist: {
    key: "minimalist", label: "Zen House",
    wall: "#f3ead6", wallShade: "#d6c9ad",
    roof: "#c7b393", roofShade: "#a08a67",
    door: "#8a5c3b", trim: "#6b5847",
    glow: "#f0dfbc", ground: "#a4b57a",
  },
  garden: {
    key: "garden", label: "Garden Cottage",
    wall: "#eadcbe", wallShade: "#cdbb91",
    roof: "#6e8a47", roofShade: "#516834",
    door: "#a65b3f", trim: "#48301d",
    glow: "#ffc55c", ground: "#93ac5f",
  },
};

/** Fallback when a persona doesn't map to a specific style. */
export const DEFAULT_STYLE_KEY = "cottage";

// Persona labels come from templates ("Creator", "Gamer", "Writer", "Minimalist"),
// but published Nests can borrow any persona — normalize loosely by keyword so new
// personas still land on a cozy style instead of the bare fallback.
export function personaToStyleKey(persona?: string): string {
  const p = (persona ?? "").toLowerCase();
  if (!p) return DEFAULT_STYLE_KEY;
  if (p.includes("game")) return "gamer";
  if (p.includes("writ") || p.includes("read") || p.includes("author")) return "writer";
  if (p.includes("minimal") || p.includes("zen") || p.includes("calm")) return "minimalist";
  if (p.includes("garden") || p.includes("nature") || p.includes("plant") || p.includes("outdoor")) return "garden";
  if (p.includes("creat") || p.includes("art") || p.includes("maker") || p.includes("design") || p.includes("studio")) return "creator";
  return DEFAULT_STYLE_KEY;
}

export function styleFor(persona?: string): HouseStyle {
  return HOUSE_STYLES[personaToStyleKey(persona)] ?? HOUSE_STYLES[DEFAULT_STYLE_KEY];
}

// ── Stable hashing (deterministic seeds — never Math.random) ───────────────────

/** FNV-1a → unsigned 32-bit. Same string ⇒ same seed, across renders and reloads. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── House ──────────────────────────────────────────────────────────────────────

export type House = {
  /** Stable id: the creator's @handle for real creators, else a generated key. */
  id: string;
  ownerId?: string;
  /** @username, when the creator has claimed one (routes to /@handle). */
  handle?: string;
  /** Display name shown on the door plate. */
  name: string;
  bio?: string;
  persona?: string;
  style: HouseStyle;
  /** Drives small, deterministic exterior variations (windows, chimney, tree side). */
  seed: number;
  /** Real creator vs a generated neighbor that keeps the village feeling alive. */
  isReal: boolean;
  /** Deterministic "someone's home" indicator — warm, not a real presence signal. */
  online: boolean;
  /** Where "Enter" leads — the creator's primary Nest, when they have one. */
  nestHref?: string;
  /** The creator's latest Nest title, for the "latest activity" line. */
  latestNestTitle?: string;
};

/** A friendly first initial for the door plate / avatar. */
export function houseInitial(house: Pick<House, "name" | "handle">): string {
  const src = (house.name || house.handle || "N").trim();
  return (src.charAt(0) || "N").toUpperCase();
}

/** Presence is derived from the seed so it's stable within a render pass. */
function presenceFromSeed(seed: number): boolean {
  return seed % 5 < 2; // ~40% "home" — enough life without feeling fake-busy
}

/**
 * Build a House from a resolved discovery creator + optional persona/nest.
 * Used for real creators (village + `/@handle` arrival).
 */
export function deriveHouse(input: {
  creator: DiscoveryCreator;
  persona?: string;
  bio?: string;
  nestHref?: string;
  latestNestTitle?: string;
}): House {
  const { creator, persona, bio, nestHref, latestNestTitle } = input;
  const id = creator.username ?? creator.id ?? creator.displayName ?? "nest";
  const seed = hashSeed(`house:${id}`);
  return {
    id,
    ownerId: creator.id,
    handle: creator.username,
    name: creator.displayName ?? (creator.username ? `@${creator.username}` : "A Nestudio creator"),
    bio,
    persona,
    style: styleFor(persona),
    seed,
    isReal: true,
    online: presenceFromSeed(seed),
    nestHref,
    latestNestTitle,
  };
}

/**
 * Collapse a creator's discovery items into a single House (a creator owns ONE
 * house; their Nests are rooms inside it). Picks the newest item as the primary
 * "Enter" target and borrows its persona.
 */
export function houseFromItems(items: DiscoveryItem[]): House | null {
  if (items.length === 0) return null;
  const primary = items[0]; // useDiscovery lists newest-first per creator
  return deriveHouse({
    creator: primary.creator,
    persona: primary.category,
    nestHref: primary.href,
    latestNestTitle: primary.title,
  });
}
