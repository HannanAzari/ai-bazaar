import type { AssetCategory, RoomKind } from "@/lib/types";

// Pure, testable mapping from an asset (and its category) to a *visual kind* the
// renderer uses to draw a richer, place-like object — and the set of room
// background variants. No new art: kinds are CSS treatments around the existing
// icon glyph, and backgrounds are palettes for the existing room shell.

export type ObjectVisual =
  | "frame" // framed artwork / wall art
  | "screen" // tv / projector
  | "shelf" // bookshelf / product / display
  | "desk" // desk / table
  | "card" // small placard / business card / sign
  | "portrait" // avatar portrait
  | "certificate" // certificate
  | "board" // achievement / pin board
  | "door" // doorway
  | "stairs" // stairs
  | "plant" // potted plant
  | "rug" // floor rug
  | "seat" // sofa / chair
  | "tile"; // generic fallback

const BY_ASSET: Record<string, ObjectVisual> = {
  "ast-painting": "frame",
  "ast-photo-wall": "frame",
  "ast-screen": "screen",
  "ast-projector": "screen",
  "ast-bookshelf": "shelf",
  "ast-product-shelf": "shelf",
  "ast-display-table": "shelf",
  "ast-desk": "desk",
  "ast-guestbook-table": "desk",
  "ast-business-card": "card",
  "ast-sign": "card",
  "ast-avatar-portrait": "portrait",
  "ast-certificate": "certificate",
  "ast-achievement-board": "board",
  "ast-door": "door",
  "ast-stairs": "stairs",
  "ast-sofa": "seat",
  "ast-rug": "rug",
  "ast-plant": "plant",
};

const BY_CATEGORY: Partial<Record<AssetCategory, ObjectVisual>> = {
  decor: "frame",
  wall: "frame",
  furniture: "seat",
  floor: "rug",
  plant: "plant",
  door: "door",
  stairs: "stairs",
};

/** The visual treatment for an object, by asset id first, then category. */
export function objectVisual(assetId: string, category?: AssetCategory): ObjectVisual {
  return BY_ASSET[assetId] ?? (category ? BY_CATEGORY[category] ?? "tile" : "tile");
}

// ── Room background variants (existing shell, recoloured) ──

export type RoomBackground = {
  id: string;
  label: string;
  /** Wall colour (drives the `--room-wall` CSS variable). */
  wall: string;
  /** Soft full-shell tint overlay to shift the room's mood. */
  tint: string;
};

export const ROOM_BACKGROUNDS: Record<string, RoomBackground> = {
  standard: { id: "standard", label: "Warm studio", wall: "#e6cfa9", tint: "transparent" },
  gallery: { id: "gallery", label: "Gallery wall", wall: "#ece4d6", tint: "rgba(150,168,196,0.10)" },
  shop: { id: "shop", label: "Shop floor", wall: "#ecd0b0", tint: "rgba(201,122,70,0.08)" },
  office: { id: "office", label: "Office", wall: "#e3ddca", tint: "rgba(120,120,92,0.08)" },
  garden: { id: "garden", label: "Garden room", wall: "#d8e4c6", tint: "rgba(110,158,86,0.12)" },
};

export const DEFAULT_BACKGROUND_ID = "standard";
export const ROOM_BACKGROUND_IDS = Object.keys(ROOM_BACKGROUNDS);

/** Resolve a background id to its variant, falling back to the warm default. */
export function roomBackground(id?: string): RoomBackground {
  return (id && ROOM_BACKGROUNDS[id]) || ROOM_BACKGROUNDS[DEFAULT_BACKGROUND_ID];
}

/** A sensible default background for a freshly created/preset room of a type. */
export function defaultBackgroundForType(type: RoomKind): string {
  switch (type) {
    case "gallery":
      return "gallery";
    case "shop":
      return "shop";
    case "office":
      return "office";
    case "garden":
      return "garden";
    default:
      return DEFAULT_BACKGROUND_ID;
  }
}
