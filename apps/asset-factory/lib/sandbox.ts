import {
  CATEGORY_META,
  type AssetCandidate,
  type FactoryCategory,
  type RoomActionType,
  type RoomZoneType,
} from "@/lib/types";

/** Room flavour label (mirrors the main app's RoomKind values; string-typed here
 * since the factory only displays it). */
type RoomKindLabel = "lounge" | "gallery" | "shop" | "office" | "studio" | "standard";
import { ZONE_DEFS, zoneDef, categoryAllowedInZone } from "@/lib/zones";

// Room Designer Sandbox (Task 5). A self-contained mirror of the main app's
// AI Room Designer (lib/ai-room-designer.ts): match a creator type to an intent,
// rank approved assets by category/tag/action/style affinity, and place the top
// picks into the nine-zone template under the SAME placement rules
// (category↔zone + capacity). The point is to prove approved assets compose into
// valid rooms — and to surface any that can't be placed. Deterministic; selection
// only; no image generation.

export type SandboxStyle = "cozy" | "minimal" | "modern" | "creative" | "professional" | "playful";

export const SANDBOX_STYLES: { id: SandboxStyle; label: string; objectCount: number; tags: string[] }[] = [
  { id: "cozy", label: "Cozy", objectCount: 6, tags: ["cozy", "warm", "reading", "green"] },
  { id: "minimal", label: "Minimal", objectCount: 4, tags: ["work", "clean", "art"] },
  { id: "modern", label: "Modern", objectCount: 5, tags: ["screen", "video", "tech"] },
  { id: "creative", label: "Creative", objectCount: 7, tags: ["art", "gallery", "studio", "photo"] },
  { id: "professional", label: "Professional", objectCount: 5, tags: ["work", "contact", "desk"] },
  { id: "playful", label: "Playful", objectCount: 7, tags: ["music", "light", "fun"] },
];

export type SandboxCreatorType =
  | "cozy_creator"
  | "photographer"
  | "podcaster"
  | "cafe"
  | "startup"
  | "artist"
  | "shop";

type Intent = {
  label: string;
  roomKind: RoomKindLabel;
  background: string;
  categories: FactoryCategory[];
  tags: string[];
  actions: RoomActionType[];
};

export const SANDBOX_CREATOR_TYPES: { id: SandboxCreatorType; label: string }[] = [
  { id: "cozy_creator", label: "Cozy creator" },
  { id: "photographer", label: "Photographer" },
  { id: "podcaster", label: "Podcaster" },
  { id: "cafe", label: "Cafe" },
  { id: "startup", label: "Startup workspace" },
  { id: "artist", label: "Artist" },
  { id: "shop", label: "Shop" },
];

const INTENTS: Record<SandboxCreatorType, Intent> = {
  cozy_creator: { label: "cozy creator room", roomKind: "lounge", background: "warm studio", categories: ["chair", "sofa", "rug", "plant", "lamp", "shelf", "wall_art", "book", "table"], tags: ["cozy", "warm", "reading", "green"], actions: ["gallery", "guestbook", "link"] },
  photographer: { label: "photography studio", roomKind: "gallery", background: "gallery wall", categories: ["camera", "wall_art", "tv_screen", "product_display", "plant", "shelf"], tags: ["photo", "gallery", "art", "memories"], actions: ["gallery", "video"] },
  podcaster: { label: "podcast lounge", roomKind: "lounge", background: "warm studio", categories: ["microphone", "podcast_setup", "sofa", "shelf", "plant", "lamp", "tv_screen"], tags: ["podcast", "audio", "music", "cozy"], actions: ["video", "booking"] },
  cafe: { label: "cafe", roomKind: "shop", background: "shop floor", categories: ["cafe_counter", "restaurant_table", "sign", "plant", "bench", "market_stall", "lantern"], tags: ["cafe", "coffee", "welcome"], actions: ["product", "gallery"] },
  startup: { label: "startup workspace", roomKind: "office", background: "office", categories: ["desk", "computer", "shelf", "lamp", "sign", "table", "wall_art", "plant"], tags: ["work", "workspace", "tech"], actions: ["contact", "link", "profile"] },
  artist: { label: "art studio", roomKind: "studio", background: "warm studio", categories: ["wall_art", "product_display", "shelf", "plant", "desk", "rug"], tags: ["art", "studio", "gallery"], actions: ["gallery", "product"] },
  shop: { label: "shop", roomKind: "shop", background: "shop floor", categories: ["product_display", "shop_shelf", "sign", "plant", "table"], tags: ["shop", "product", "retail"], actions: ["product", "gallery"] },
};

const ACTION_LABEL: Record<RoomActionType, string> = {
  link: "Open link", video: "Play video", product: "View product", booking: "Book a time",
  contact: "Contact", gallery: "Open gallery", profile: "View profile", room_link: "Go to room",
  guestbook: "Sign guestbook", collection: "Save", none: "Decorative",
};

export type SandboxPlacement = {
  assetId: string;
  assetName: string;
  category: FactoryCategory;
  zoneType: RoomZoneType;
  zoneLabel: string;
  action: RoomActionType;
  reason: string;
};

export type SandboxUnplaced = { assetId: string; assetName: string; reason: string };

export type SandboxResult = {
  creatorType: SandboxCreatorType;
  style: SandboxStyle;
  intentLabel: string;
  roomKind: RoomKindLabel;
  background: string;
  poolSize: number;
  placements: SandboxPlacement[];
  unplaced: SandboxUnplaced[];
  zoneUsage: { zoneType: RoomZoneType; used: number; max: number }[];
  explanations: string[];
};

type Scored = { c: AssetCandidate; score: number; matchedTags: string[]; core: boolean };

function scoreCandidate(c: AssetCandidate, intent: Intent, style: SandboxStyle): Scored {
  let score = 1;
  const catIndex = intent.categories.indexOf(c.category);
  const core = catIndex >= 0;
  if (core) score += 6 - Math.min(catIndex, 5);

  const matchedTags = c.tags.filter((t) => intent.tags.includes(t));
  score += matchedTags.length * 2;

  if (intent.actions.includes(c.defaultActionType)) score += 2;

  const stylePreset = SANDBOX_STYLES.find((s) => s.id === style)!;
  score += c.tags.filter((t) => stylePreset.tags.includes(t)).length;

  return { c, score, matchedTags, core };
}

function reasonFor(s: Scored, intent: Intent): string {
  if (s.core) return `it's core to a ${intent.label}`;
  if (s.matchedTags.length > 0) return `its tags (${s.matchedTags.join(", ")}) fit`;
  if (s.c.defaultActionType !== "none" && intent.actions.includes(s.c.defaultActionType)) {
    return `it adds a “${ACTION_LABEL[s.c.defaultActionType]}” action that fits`;
  }
  return "it rounds out the space";
}

export type SandboxInput = {
  candidates: AssetCandidate[];
  creatorType: SandboxCreatorType;
  style: SandboxStyle;
  /** Restrict the pool to these candidate ids (a chosen pack). */
  packAssetIds?: string[];
};

/** Generate a sandbox room composition from approved assets. Deterministic. */
export function generateSandboxRoom(input: SandboxInput): SandboxResult {
  const intent = INTENTS[input.creatorType];
  const stylePreset = SANDBOX_STYLES.find((s) => s.id === input.style)!;
  const target = stylePreset.objectCount;

  // Pool: approved candidates, optionally restricted to a pack.
  let pool = input.candidates.filter((c) => c.status === "approved");
  if (input.packAssetIds) {
    const ids = new Set(input.packAssetIds);
    pool = pool.filter((c) => ids.has(c.id));
  }

  const ranked = pool
    .map((c) => scoreCandidate(c, intent, input.style))
    .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));

  // Capacity tracker per zone.
  const usage = new Map<RoomZoneType, number>(ZONE_DEFS.map((z) => [z.type, 0]));

  const placements: SandboxPlacement[] = [];
  const unplaced: SandboxUnplaced[] = [];

  for (const s of ranked) {
    if (placements.length >= target) break;
    const meta = CATEGORY_META[s.c.category];
    if (!meta) {
      unplaced.push({ assetId: s.c.id, assetName: s.c.name, reason: "unknown category" });
      continue;
    }
    // First compatible zone with free capacity.
    const zoneType = s.c.compatibleZones.find((z) => {
      const def = zoneDef(z);
      return def && categoryAllowedInZone(meta.nestudioCategory, z) && (usage.get(z) ?? 0) < def.maxObjects;
    });
    if (!zoneType) {
      unplaced.push({ assetId: s.c.id, assetName: s.c.name, reason: "no free compatible zone (zones full or category mismatch)" });
      continue;
    }
    usage.set(zoneType, (usage.get(zoneType) ?? 0) + 1);
    placements.push({
      assetId: s.c.id,
      assetName: s.c.name,
      category: s.c.category,
      zoneType,
      zoneLabel: zoneDef(zoneType)!.label,
      action: s.c.defaultActionType,
      reason: reasonFor(s, intent),
    });
  }

  const explanations: string[] = [];
  explanations.push(`Composed a ${intent.label} in the ${stylePreset.label} style from ${pool.length} approved asset(s).`);
  explanations.push(`Target ${target} objects; placed ${placements.length}.`);
  if (unplaced.length > 0) explanations.push(`${unplaced.length} asset(s) could not be placed — see below.`);
  for (const p of placements) explanations.push(`Placed ${p.assetName} on the ${p.zoneLabel} because ${p.reason}.`);

  return {
    creatorType: input.creatorType,
    style: input.style,
    intentLabel: intent.label,
    roomKind: intent.roomKind,
    background: intent.background,
    poolSize: pool.length,
    placements,
    unplaced,
    zoneUsage: ZONE_DEFS.map((z) => ({ zoneType: z.type, used: usage.get(z.type) ?? 0, max: z.maxObjects })),
    explanations,
  };
}
