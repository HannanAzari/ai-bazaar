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
};

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
  const style = input.style ?? "cozy";
  const variant = input.variant ?? 0;
  const { intent, matchedKeywords } = matchIntent(input.brief);

  const roomType = input.roomType ?? intent.roomKind;
  const background = input.roomType ? defaultBackgroundForType(input.roomType) : intent.background;
  const name = roomNameFromBrief(input.brief, intent.label);

  let room = createRoom(input.address, name, roomType);
  room = { ...room, background };

  const ranked = scoreAssets(intent, style, variant);
  const target = STYLE_PRESETS[style].objectCount;

  const picks: DesignPick[] = [];
  for (const scored of ranked) {
    if (picks.length >= target) break;
    const label = labelFor(scored.asset);
    const action = scored.asset.defaultActionType ?? "none";
    const next = addObjectFromAsset(room, scored.asset, label, { type: action });
    // addObjectFromAsset is a no-op when no compatible zone has a free slot.
    if (next.objects.length === room.objects.length) continue;
    room = next;
    picks.push({ assetId: scored.asset.id, assetName: scored.asset.name, label, action, reason: pickReason(scored, intent) });
  }

  const explanations = explainDesign({ intent, matchedKeywords, style, background, picks });
  return {
    room,
    intentId: intent.id,
    intentLabel: intent.label,
    style,
    matchedKeywords,
    picks,
    explanations,
  };
}

function explainDesign(args: {
  intent: DesignIntent;
  matchedKeywords: string[];
  style: DesignStyle;
  background: string;
  picks: DesignPick[];
}): string[] {
  const { intent, matchedKeywords, style, background, picks } = args;
  const lines: string[] = [];

  if (matchedKeywords.length > 0) {
    lines.push(`Read your brief as a ${intent.label} — matched on ${matchedKeywords.slice(0, 4).join(", ")}.`);
  } else {
    lines.push(`No strong theme detected, so I composed a balanced ${intent.label}.`);
  }

  const bg = roomBackground(background);
  lines.push(`Chose the “${bg.label}” background because it suits a ${intent.label}.`);
  lines.push(`Applied the ${STYLE_PRESETS[style].label} style — ${STYLE_PRESETS[style].description.toLowerCase()}`);

  for (const pick of picks) {
    lines.push(`Added ${pick.assetName} (“${pick.label}”) because ${pick.reason}.`);
  }
  return lines;
}

/** Background label lookup for the UI (re-exported convenience). */
export function backgroundLabel(id: string): string {
  return (ROOM_BACKGROUNDS[id] ?? roomBackground(id)).label;
}
