import type { CatalogAsset, Room, RoomActionType, RoomKind } from "@/lib/types";
import { roomReadyAssets } from "@/lib/assets";
import { actionLabels, addObjectFromAsset, createRoom } from "@/lib/room-schema";
import { ROOM_BACKGROUNDS, defaultBackgroundForType, roomBackground } from "@/lib/room-visuals";

// ── AI Room Designer (V1) ────────────────────────────────────────────────────
//
// A DETERMINISTIC, rules-based room designer. It NEVER generates visuals — it
// only *selects and arranges existing catalog assets* (ADR-006, room-engine-spec
// §11). No external APIs, no image/LLM providers. Given a natural-language brief
// (+ optional style and room type), it:
//   1. matches the brief to a design intent (keyword scoring),
//   2. ranks the room-ready assets against that intent + the chosen style,
//   3. composes a valid Room via the same placement helpers as every other edit
//      (addObjectFromAsset → zone/category/capacity validation), and
//   4. explains, in plain language, why each choice was made.
//
// Determinism: identical input (brief, style, roomType, variant) always yields
// the identical room composition and explanations. "Regenerate" simply bumps the
// `variant`, which deterministically reshuffles near-ties so the owner sees a
// fresh-but-reproducible layout. Object ids carry a timestamp (as everywhere in
// the engine), so compare assetIds / zones / labels — not ids — for equality.

export type DesignStyle =
  | "cozy"
  | "minimal"
  | "modern"
  | "creative"
  | "professional"
  | "playful";

export const DESIGN_STYLES: DesignStyle[] = [
  "cozy",
  "minimal",
  "modern",
  "creative",
  "professional",
  "playful",
];

type StylePreset = {
  label: string;
  description: string;
  /** Target number of objects to place (a soft cap, clamped to what fits). */
  objectCount: number;
  /** Asset tags this style favours (small scoring bonus). */
  tags: string[];
  /** Actions this style leans toward (small scoring bonus). */
  actions: RoomActionType[];
};

const STYLE_PRESETS: Record<DesignStyle, StylePreset> = {
  cozy: {
    label: "Cozy",
    description: "Warm and lived-in — soft seating, plants, and personal touches.",
    objectCount: 6,
    tags: ["cosy", "warm", "nature", "green", "books", "memories"],
    actions: ["gallery", "guestbook"],
  },
  minimal: {
    label: "Minimal",
    description: "A calm, uncluttered space with only a few deliberate pieces.",
    objectCount: 4,
    tags: ["art", "work", "notes"],
    actions: ["link", "profile"],
  },
  modern: {
    label: "Modern",
    description: "Clean and screen-forward — media, links, and crisp displays.",
    objectCount: 5,
    tags: ["video", "screen", "link", "film"],
    actions: ["video", "link"],
  },
  creative: {
    label: "Creative",
    description: "Expressive and full — galleries, studio gear, and showpieces.",
    objectCount: 7,
    tags: ["art", "painting", "studio", "photos", "gallery"],
    actions: ["gallery", "product"],
  },
  professional: {
    label: "Professional",
    description: "Polished and credible — a desk, credentials, and clear contact.",
    objectCount: 5,
    tags: ["work", "contact", "card", "badge", "stats"],
    actions: ["contact", "profile", "link"],
  },
  playful: {
    label: "Playful",
    description: "Lively and packed — lots to notice, browse, and click.",
    objectCount: 7,
    tags: ["evening", "light", "origami", "paper", "music"],
    actions: ["gallery", "video"],
  },
};

export function styleLabel(style: DesignStyle): string {
  return STYLE_PRESETS[style].label;
}

export function styleDescription(style: DesignStyle): string {
  return STYLE_PRESETS[style].description;
}

// ── Design intents (brief → meaning) ─────────────────────────────────────────

type DesignIntent = {
  id: string;
  /** Human label used in explanations, e.g. "reading room". */
  label: string;
  /** Brief substrings that signal this intent. */
  keywords: string[];
  roomKind: RoomKind;
  /** Background variant id (must exist in ROOM_BACKGROUNDS). */
  background: string;
  /** Asset tags that fit this intent (drive scoring). */
  assetTags: string[];
  /** Asset ids that are core to this intent (ordered, strongest first). */
  preferredAssets: string[];
  /** Actions that suit this intent. */
  actions: RoomActionType[];
};

// Ordered: earlier intents win ties. The trailing "personal" intent is the
// always-matching fallback so an unrecognised brief still produces a room.
export const DESIGN_INTENTS: DesignIntent[] = [
  {
    id: "reading",
    label: "reading room",
    keywords: ["read", "reading", "book", "books", "library", "literature", "study", "writer", "writing", "poetry"],
    roomKind: "lounge",
    background: "standard",
    assetTags: ["books", "links", "cosy", "warm", "nature"],
    preferredAssets: ["ast-bookshelf", "ast-sofa", "ast-plant", "ast-painting", "ast-rug", "ast-guestbook-table"],
    actions: ["link", "gallery", "guestbook"],
  },
  {
    id: "photography",
    label: "photography studio",
    keywords: ["photo", "photos", "photography", "photographer", "camera", "portfolio", "shots", "darkroom"],
    roomKind: "gallery",
    background: "gallery",
    assetTags: ["photos", "art", "gallery", "memories"],
    preferredAssets: ["ast-photo-wall", "ast-painting", "ast-screen", "ast-display-table", "ast-plant", "ast-guestbook-table"],
    actions: ["gallery", "video"],
  },
  {
    id: "gallery",
    label: "art gallery",
    keywords: ["gallery", "exhibit", "exhibition", "art show", "curator", "fine art"],
    roomKind: "gallery",
    background: "gallery",
    assetTags: ["art", "gallery", "painting", "photos"],
    preferredAssets: ["ast-painting", "ast-photo-wall", "ast-achievement-board", "ast-product-shelf", "ast-plant", "ast-rug"],
    actions: ["gallery", "product"],
  },
  {
    id: "art_studio",
    label: "art studio",
    keywords: ["art", "artist", "paint", "painting", "draw", "drawing", "illustration", "sketch", "studio", "maker"],
    roomKind: "studio",
    background: "standard",
    assetTags: ["art", "painting", "studio", "print"],
    preferredAssets: ["ast-painting", "ast-photo-wall", "ast-product-shelf", "ast-achievement-board", "ast-desk", "ast-rug"],
    actions: ["gallery", "product", "profile"],
  },
  {
    id: "gaming",
    label: "gaming room",
    keywords: ["gaming", "game", "gamer", "stream", "streamer", "twitch", "arcade", "esports", "console"],
    roomKind: "lounge",
    background: "standard",
    assetTags: ["video", "screen", "lounge", "film"],
    preferredAssets: ["ast-screen", "ast-projector", "ast-sofa", "ast-sign", "ast-rug", "ast-plant"],
    actions: ["video", "link"],
  },
  {
    id: "podcast",
    label: "podcast lounge",
    keywords: ["podcast", "music", "audio", "record", "recording", "sound", "radio", "dj", "song", "band"],
    roomKind: "lounge",
    background: "standard",
    assetTags: ["music", "video", "lounge", "cosy"],
    preferredAssets: ["ast-screen", "ast-sofa", "ast-desk", "ast-bookshelf", "ast-plant", "ast-rug"],
    actions: ["video", "booking", "link"],
  },
  {
    id: "office",
    label: "office",
    keywords: ["office", "work", "workspace", "professional", "minimalist office", "desk", "consultant", "freelance", "developer", "coder", "engineer"],
    roomKind: "office",
    background: "office",
    assetTags: ["work", "notes", "contact", "links", "badge", "card"],
    preferredAssets: ["ast-desk", "ast-bookshelf", "ast-certificate", "ast-business-card", "ast-screen", "ast-plant"],
    actions: ["contact", "link", "profile"],
  },
  {
    id: "shop",
    label: "shop",
    keywords: ["shop", "store", "sell", "selling", "products", "product", "boutique", "market", "merch", "storefront"],
    roomKind: "shop",
    background: "shop",
    assetTags: ["shop", "products", "product"],
    preferredAssets: ["ast-product-shelf", "ast-display-table", "ast-painting", "ast-guestbook-table", "ast-rug", "ast-plant"],
    actions: ["product", "gallery"],
  },
  {
    id: "garden",
    label: "garden room",
    keywords: ["garden", "plant", "plants", "nature", "green", "calm", "tea", "cafe", "café", "zen", "botanical"],
    roomKind: "garden",
    background: "garden",
    assetTags: ["nature", "green", "cosy", "warm"],
    preferredAssets: ["ast-plant", "ast-sofa", "ast-rug", "ast-painting", "ast-guestbook-table", "ast-bookshelf"],
    actions: ["gallery", "guestbook"],
  },
  {
    id: "personal",
    label: "personal room",
    keywords: [],
    roomKind: "standard",
    background: "standard",
    assetTags: ["cosy", "warm", "art", "links"],
    preferredAssets: ["ast-painting", "ast-bookshelf", "ast-avatar-portrait", "ast-sofa", "ast-plant", "ast-guestbook-table"],
    actions: ["gallery", "link", "profile", "guestbook"],
  },
];

const FALLBACK_INTENT = DESIGN_INTENTS[DESIGN_INTENTS.length - 1];

/** Split a brief into lowercase word tokens (length ≥ 2). */
export function tokenize(brief: string): string[] {
  return brief
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

export type IntentMatch = { intent: DesignIntent; matchedKeywords: string[]; score: number };

/**
 * Pick the design intent whose keywords best match the brief. Deterministic:
 * ties resolve to the earlier intent in DESIGN_INTENTS; no match → the personal
 * fallback. Matching is word-aware (token equality) plus a phrase contains-check
 * so multi-word keywords like "minimalist office" still register.
 */
export function matchIntent(brief: string): IntentMatch {
  const tokens = new Set(tokenize(brief));
  const lower = brief.toLowerCase();
  let best: IntentMatch = { intent: FALLBACK_INTENT, matchedKeywords: [], score: 0 };

  for (const intent of DESIGN_INTENTS) {
    const matched: string[] = [];
    for (const keyword of intent.keywords) {
      const isPhrase = keyword.includes(" ");
      if (isPhrase ? lower.includes(keyword) : tokens.has(keyword)) matched.push(keyword);
    }
    if (matched.length > best.score) {
      best = { intent, matchedKeywords: matched, score: matched.length };
    }
  }
  return best;
}

// ── V2: advanced brief parsing (creator type · mood · purpose · constraints) ──
//
// All detection is deterministic keyword matching — no model, no API. Each
// dimension is optional; an unrecognised brief simply leaves it undefined and the
// designer falls back to its intent/style defaults.

export type CreatorType =
  | "photographer"
  | "artist"
  | "developer"
  | "podcaster"
  | "shop_owner"
  | "writer"
  | "musician"
  | "designer"
  | "coach"
  | "small_business";

export type Mood =
  | "cozy"
  | "luxury"
  | "dark"
  | "playful"
  | "professional"
  | "warm"
  | "minimal"
  | "elegant";

export type Purpose =
  | "portfolio"
  | "booking"
  | "selling"
  | "storytelling"
  | "community"
  | "personal_profile"
  | "gallery";

export type DesignConstraints = {
  noPlants?: boolean;
  noVideo?: boolean;
  noProducts?: boolean;
  /** Hard cap on the number of placed objects. */
  maxObjects?: number;
  /** "Make it clean / minimal" — fewer objects. */
  minimal?: boolean;
  showSocialLinks?: boolean;
  showBooking?: boolean;
  showGallery?: boolean;
};

export type ParsedBrief = {
  creatorType?: CreatorType;
  mood?: Mood;
  purpose?: Purpose;
  constraints: DesignConstraints;
};

// Ordered detection tables: the first keyword that matches wins for that
// dimension, so ordering is the deterministic tie-break.
const CREATOR_TYPE_KEYWORDS: [CreatorType, string[]][] = [
  ["photographer", ["photographer", "photography", "photo", "photos", "camera"]],
  ["podcaster", ["podcaster", "podcast", "podcasting"]],
  ["developer", ["developer", "engineer", "coder", "programmer", "software", "dev"]],
  ["musician", ["musician", "music", "band", "dj", "producer", "songwriter"]],
  ["designer", ["designer", "design studio", "ux", "ui", "graphic"]],
  ["writer", ["writer", "author", "blogger", "novelist", "journalist", "poet"]],
  ["coach", ["coach", "consultant", "mentor", "advisor", "trainer", "therapist"]],
  ["shop_owner", ["shop owner", "shopkeeper", "store owner", "merchant", "seller"]],
  ["small_business", ["small business", "business owner", "studio owner", "boutique"]],
  ["artist", ["artist", "painter", "illustrator", "sculptor", "maker"]],
];

const MOOD_KEYWORDS: [Mood, string[]][] = [
  ["luxury", ["luxury", "luxurious", "lavish", "opulent", "premium"]],
  ["elegant", ["elegant", "refined", "sophisticated", "classy", "chic"]],
  ["dark", ["dark", "moody", "noir", "midnight", "black"]],
  ["minimal", ["minimal", "minimalist", "clean", "simple", "uncluttered", "spare"]],
  ["playful", ["playful", "fun", "quirky", "whimsical", "lively"]],
  ["professional", ["professional", "corporate", "businesslike", "polished"]],
  ["cozy", ["cozy", "cosy", "snug", "homey", "comfortable"]],
  ["warm", ["warm", "inviting", "welcoming"]],
];

const PURPOSE_KEYWORDS: [Purpose, string[]][] = [
  ["booking", ["booking", "bookings", "appointment", "appointments", "schedule", "scheduling", "book a"]],
  ["selling", ["selling", "sell", "sale", "shop", "store", "products", "merch", "ecommerce"]],
  ["portfolio", ["portfolio", "showcase", "show my work", "case studies"]],
  ["gallery", ["gallery", "exhibit", "exhibition"]],
  ["storytelling", ["storytelling", "story", "journal", "blog", "narrative"]],
  ["community", ["community", "guestbook", "visitors", "fans", "audience"]],
  ["personal_profile", ["personal", "bio", "about me", "profile", "introduce"]],
];

/** Detect a hard object cap from phrasings like "only 4 objects" / "max 3". */
function detectMaxObjects(brief: string): number | undefined {
  const match = brief.match(/(?:only|max(?:imum)?|just|up to)\s+(\d{1,2})\s*(?:objects|items|things|pieces)?/i)
    ?? brief.match(/(\d{1,2})\s+objects/i);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : undefined;
}

function firstMatch<T>(table: [T, string[]][], brief: string, tokens: Set<string>): T | undefined {
  for (const [value, keywords] of table) {
    for (const keyword of keywords) {
      const hit = keyword.includes(" ") ? brief.includes(keyword) : tokens.has(keyword);
      if (hit) return value;
    }
  }
  return undefined;
}

function has(brief: string, ...phrases: string[]): boolean {
  return phrases.some((p) => brief.includes(p));
}

/** Parse a natural-language brief into structured creator/mood/purpose/constraints. */
export function parseBrief(brief: string): ParsedBrief {
  const lower = brief.toLowerCase();
  const tokens = new Set(tokenize(brief));

  const constraints: DesignConstraints = {};
  if (has(lower, "no plant", "no plants", "without plant", "no greenery")) constraints.noPlants = true;
  if (has(lower, "no video", "without video", "no videos", "no screen")) constraints.noVideo = true;
  if (has(lower, "no product", "no products", "without product", "don't sell", "not selling")) constraints.noProducts = true;
  const max = detectMaxObjects(lower);
  if (max !== undefined) constraints.maxObjects = max;
  if (has(lower, "minimal", "minimalist", "make it clean", "keep it clean", "clean look", "uncluttered", "simple", "few objects", "spare")) constraints.minimal = true;
  if (has(lower, "social link", "social links", "socials", "social media", "my links")) constraints.showSocialLinks = true;
  if (has(lower, "booking", "bookings", "appointment", "schedule", "book a")) constraints.showBooking = true;
  if (has(lower, "gallery", "portfolio", "showcase", "show my work")) constraints.showGallery = true;

  return {
    creatorType: firstMatch(CREATOR_TYPE_KEYWORDS, lower, tokens),
    mood: firstMatch(MOOD_KEYWORDS, lower, tokens),
    purpose: firstMatch(PURPOSE_KEYWORDS, lower, tokens),
    constraints,
  };
}

// Map a detected creator type to the design intent that selects its assets.
const CREATOR_TYPE_INTENT: Record<CreatorType, string> = {
  photographer: "photography",
  artist: "art_studio",
  developer: "office",
  podcaster: "podcast",
  shop_owner: "shop",
  writer: "reading",
  musician: "podcast",
  designer: "art_studio",
  coach: "office",
  small_business: "shop",
};

// Map a detected mood to a style preset (used only when no style is supplied).
const MOOD_STYLE: Record<Mood, DesignStyle> = {
  cozy: "cozy",
  warm: "cozy",
  luxury: "professional",
  elegant: "modern",
  dark: "modern",
  playful: "playful",
  professional: "professional",
  minimal: "minimal",
};

export const creatorTypeLabels: Record<CreatorType, string> = {
  photographer: "Photographer",
  artist: "Artist",
  developer: "Developer",
  podcaster: "Podcaster",
  shop_owner: "Shop owner",
  writer: "Writer",
  musician: "Musician",
  designer: "Designer",
  coach: "Coach / consultant",
  small_business: "Small business",
};

export const moodLabels: Record<Mood, string> = {
  cozy: "Cozy", luxury: "Luxury", dark: "Dark", playful: "Playful",
  professional: "Professional", warm: "Warm", minimal: "Minimal", elegant: "Elegant",
};

export const purposeLabels: Record<Purpose, string> = {
  portfolio: "Portfolio", booking: "Booking", selling: "Selling",
  storytelling: "Storytelling", community: "Community",
  personal_profile: "Personal profile", gallery: "Gallery",
};

// ── V2: one-click creator presets (fill brief + style) ──
export type CreatorPreset = { id: string; label: string; brief: string; style: DesignStyle };

export const CREATOR_PRESETS: CreatorPreset[] = [
  { id: "photographer", label: "Photographer Portfolio", brief: "A photographer portfolio with a gallery wall and a showreel", style: "creative" },
  { id: "artist", label: "Artist Gallery", brief: "An artist gallery showcasing my paintings and prints for sale", style: "creative" },
  { id: "developer", label: "Developer Studio", brief: "A minimalist developer studio with my projects and contact desk", style: "minimal" },
  { id: "podcast", label: "Podcast Room", brief: "A cozy podcast room with an episode screen and booking desk", style: "cozy" },
  { id: "shop", label: "Online Shop", brief: "An online shop selling products with a welcome display", style: "modern" },
  { id: "writer", label: "Writer's Room", brief: "A cozy writer's room with a bookshelf and reading nook", style: "cozy" },
  { id: "coach", label: "Coach / Consultant", brief: "A professional coaching office with booking and social links", style: "professional" },
  { id: "bio", label: "Personal Bio Room", brief: "A warm personal bio room with an about-me profile and my links", style: "cozy" },
];

// ── Deterministic per-variant jitter (reshuffles near-ties on regenerate) ──
function hashJitter(seed: string, variant: number): number {
  let h = 2166136261 ^ variant;
  const str = `${seed}#${variant}`;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export type AssetScore = {
  asset: CatalogAsset;
  score: number;
  /** Tags on the asset that overlapped the intent (for explanations). */
  matchedTags: string[];
  /** True when the asset is one of the intent's core/preferred assets. */
  core: boolean;
};

/**
 * Score and rank the room-ready assets for an intent + style. Pure and
 * deterministic for a given (intent, style, variant). Navigation assets
 * (door/stairs) are excluded — a single generated room has no link targets.
 */
export function scoreAssets(intent: DesignIntent, style: DesignStyle, variant = 0): AssetScore[] {
  const preset = STYLE_PRESETS[style];
  const candidates = roomReadyAssets().filter((asset) => asset.category !== "door" && asset.category !== "stairs");

  const scored: AssetScore[] = candidates.map((asset) => {
    let score = 1; // baseline so every asset is rankable
    const preferredIndex = intent.preferredAssets.indexOf(asset.id);
    const core = preferredIndex >= 0;
    if (core) score += 8 - Math.min(preferredIndex, 6);

    const matchedTags = asset.tags.filter((tag) => intent.assetTags.includes(tag));
    score += matchedTags.length * 2;

    const action = asset.defaultActionType ?? "none";
    if (intent.actions.includes(action)) score += 2;

    score += asset.tags.filter((tag) => preset.tags.includes(tag)).length * 1;
    if (preset.actions.includes(action)) score += 1;

    score += hashJitter(asset.id, variant) * 1.5;
    return { asset, score, matchedTags, core };
  });

  // Sort by score desc; break exact ties by asset id for stable, reproducible order.
  return scored.sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));
}

// Friendly, action-aware labels for placed objects (fall back to the asset name).
const LABELS: Record<string, string> = {
  "ast-bookshelf": "My links",
  "ast-painting": "Featured work",
  "ast-photo-wall": "Gallery wall",
  "ast-screen": "Watch",
  "ast-projector": "Showreel",
  "ast-desk": "Get in touch",
  "ast-guestbook-table": "Sign my guestbook",
  "ast-product-shelf": "For sale",
  "ast-display-table": "Featured product",
  "ast-avatar-portrait": "About me",
  "ast-certificate": "Credentials",
  "ast-achievement-board": "Highlights",
  "ast-sign": "Find me online",
  "ast-business-card": "Contact card",
};

function labelFor(asset: CatalogAsset): string {
  return LABELS[asset.id] ?? asset.name;
}

function pickReason(score: AssetScore, intent: DesignIntent): string {
  if (score.core) return `it's core to a ${intent.label}`;
  if (score.matchedTags.length > 0) return `its tags (${score.matchedTags.join(", ")}) match your brief`;
  const action = score.asset.defaultActionType ?? "none";
  if (action !== "none" && intent.actions.includes(action)) {
    return `it adds a “${actionLabels[action]}” action that fits`;
  }
  return "it rounds out the space";
}

export type DesignPick = {
  assetId: string;
  assetName: string;
  label: string;
  action: RoomActionType;
  reason: string;
};

export type DesignInput = {
  brief: string;
  address: string;
  style?: DesignStyle;
  /** Optional room-type override; otherwise derived from the matched intent. */
  roomType?: RoomKind;
  /** Bumped by "Regenerate" to reshuffle near-ties deterministically. */
  variant?: number;
};

export type DesignResult = {
  room: Room;
  intentId: string;
  intentLabel: string;
  style: DesignStyle;
  matchedKeywords: string[];
  picks: DesignPick[];
  explanations: string[];
  /** V2: the structured brief (creator type · mood · purpose · constraints). */
  parsed: ParsedBrief;
  /** V2: human labels for the constraints that were applied. */
  detectedConstraints: string[];
};

// ── V2: constraint + purpose helpers (pure) ──

/** Extra score for assets that satisfy the brief's purpose / show-X constraints. */
function boostFor(asset: CatalogAsset, parsed: ParsedBrief): number {
  let bonus = 0;
  const c = parsed.constraints;
  const action = asset.defaultActionType ?? "none";
  if (parsed.purpose === "selling" && action === "product") bonus += 6;
  if ((c.showBooking || parsed.purpose === "booking") && asset.id === "ast-desk") bonus += 6;
  if ((c.showGallery || parsed.purpose === "portfolio" || parsed.purpose === "gallery") && (asset.id === "ast-painting" || asset.id === "ast-photo-wall")) bonus += 5;
  if (c.showSocialLinks && (asset.id === "ast-business-card" || asset.id === "ast-sign" || asset.id === "ast-bookshelf")) bonus += 5;
  if (parsed.purpose === "personal_profile" && action === "profile") bonus += 4;
  if (parsed.purpose === "community" && action === "guestbook") bonus += 4;
  return bonus;
}

/** True when a constraint forbids this asset entirely. */
function excludedByConstraints(asset: CatalogAsset, c: DesignConstraints): boolean {
  if (c.noPlants && asset.category === "plant") return true;
  const action = asset.defaultActionType ?? "none";
  if (c.noVideo && action === "video") return true;
  if (c.noProducts && action === "product") return true;
  return false;
}

/** The action an asset should carry given the brief (e.g. desk → booking). */
function actionForAsset(asset: CatalogAsset, parsed: ParsedBrief): RoomActionType {
  const c = parsed.constraints;
  if (asset.id === "ast-desk" && (c.showBooking || parsed.purpose === "booking")) return "booking";
  if (asset.id === "ast-business-card" && c.showSocialLinks) return "contact";
  return asset.defaultActionType ?? "none";
}

/** Human-readable labels for the active constraints (panel + analytics). */
export function describeConstraints(c: DesignConstraints): string[] {
  const out: string[] = [];
  if (c.noPlants) out.push("no plants");
  if (c.noVideo) out.push("no video");
  if (c.noProducts) out.push("no products");
  if (c.minimal) out.push("minimal / clean");
  if (c.maxObjects !== undefined) out.push(`max ${c.maxObjects} objects`);
  if (c.showSocialLinks) out.push("show social links");
  if (c.showBooking) out.push("show booking");
  if (c.showGallery) out.push("show gallery");
  return out;
}

function roomNameFromBrief(brief: string, intentLabel: string): string {
  const cleaned = brief.trim().replace(/\s+/g, " ");
  if (!cleaned) return intentLabel.replace(/\b\w/g, (c) => c.toUpperCase());
  const titled = cleaned.slice(0, 48).replace(/\b\w/g, (c) => c.toUpperCase());
  return titled;
}

/**
 * Generate a complete, valid room from a brief. The result is a normal `Room`
 * built from existing catalog assets through the standard placement rules, plus
 * the reasoning behind every choice. Nothing is persisted — the caller previews
 * and decides whether to apply.
 */
export function generateRoomDesign(input: DesignInput): DesignResult {
  const variant = input.variant ?? 0;
  const parsed = parseBrief(input.brief);
  const constraints = parsed.constraints;

  // Intent: prefer the detected creator type, else keyword-match the brief.
  const keywordMatch = matchIntent(input.brief);
  const intent = parsed.creatorType
    ? DESIGN_INTENTS.find((i) => i.id === CREATOR_TYPE_INTENT[parsed.creatorType!]) ?? keywordMatch.intent
    : keywordMatch.intent;
  const matchedKeywords = keywordMatch.matchedKeywords;

  // Style: explicit wins; else derive from the detected mood; else cozy.
  const style = input.style ?? (parsed.mood ? MOOD_STYLE[parsed.mood] : undefined) ?? "cozy";

  const roomType = input.roomType ?? intent.roomKind;
  const background = input.roomType ? defaultBackgroundForType(input.roomType) : intent.background;
  const name = roomNameFromBrief(input.brief, intent.label);

  let room = createRoom(input.address, name, roomType);
  room = { ...room, background };

  // Rank → apply purpose/constraint boosts → drop constrained assets → re-sort.
  let ranked = scoreAssets(intent, style, variant).map((s) => ({ ...s, score: s.score + boostFor(s.asset, parsed) }));
  ranked = ranked
    .filter((s) => !excludedByConstraints(s.asset, constraints))
    .sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));

  // Target object count: the style default, tightened by minimal / maxObjects.
  let target = STYLE_PRESETS[style].objectCount;
  if (constraints.minimal) target = Math.min(target, 4);
  if (constraints.maxObjects !== undefined) target = Math.min(target, constraints.maxObjects);
  target = Math.max(target, 1);

  const picks: DesignPick[] = [];
  for (const scored of ranked) {
    if (picks.length >= target) break;
    const label = labelFor(scored.asset);
    const action = actionForAsset(scored.asset, parsed);
    const next = addObjectFromAsset(room, scored.asset, label, { type: action });
    // addObjectFromAsset is a no-op when no compatible zone has a free slot.
    if (next.objects.length === room.objects.length) continue;
    room = next;
    picks.push({ assetId: scored.asset.id, assetName: scored.asset.name, label, action, reason: pickReason(scored, intent) });
  }

  const detectedConstraints = describeConstraints(constraints);
  const explanations = explainDesign({ intent, matchedKeywords, style, background, picks, parsed, detectedConstraints });
  return {
    room,
    intentId: intent.id,
    intentLabel: intent.label,
    style,
    matchedKeywords,
    picks,
    explanations,
    parsed,
    detectedConstraints,
  };
}

function explainDesign(args: {
  intent: DesignIntent;
  matchedKeywords: string[];
  style: DesignStyle;
  background: string;
  picks: DesignPick[];
  parsed: ParsedBrief;
  detectedConstraints: string[];
}): string[] {
  const { intent, matchedKeywords, style, background, picks, parsed, detectedConstraints } = args;
  const lines: string[] = [];

  // Theme line first (kept stable so callers can read the headline at [0]).
  if (matchedKeywords.length > 0) {
    lines.push(`Read your brief as a ${intent.label} — matched on ${matchedKeywords.slice(0, 4).join(", ")}.`);
  } else if (parsed.creatorType) {
    lines.push(`Detected a ${creatorTypeLabels[parsed.creatorType].toLowerCase()}, so I composed a ${intent.label}.`);
  } else {
    lines.push(`No strong theme detected, so I composed a balanced ${intent.label}.`);
  }

  if (parsed.creatorType) lines.push(`Creator type: ${creatorTypeLabels[parsed.creatorType]}.`);
  if (parsed.mood) lines.push(`Mood: ${moodLabels[parsed.mood]}.`);
  if (parsed.purpose) lines.push(`Purpose: ${purposeLabels[parsed.purpose]}.`);

  const bg = roomBackground(background);
  lines.push(`Chose the “${bg.label}” background because it suits a ${intent.label}.`);
  lines.push(`Applied the ${STYLE_PRESETS[style].label} style — ${STYLE_PRESETS[style].description.toLowerCase()}`);

  if (detectedConstraints.length > 0) lines.push(`Respected your constraints: ${detectedConstraints.join(", ")}.`);

  for (const pick of picks) {
    lines.push(`Added ${pick.assetName} (“${pick.label}”) because ${pick.reason}.`);
  }
  return lines;
}

/** Background label lookup for the UI (re-exported convenience). */
export function backgroundLabel(id: string): string {
  return (ROOM_BACKGROUNDS[id] ?? roomBackground(id)).label;
}
