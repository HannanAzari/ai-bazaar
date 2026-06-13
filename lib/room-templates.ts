import type { CatalogAsset, Room, RoomActionType, RoomKind } from "@/lib/types";
import { getAsset } from "@/lib/assets";
import { addObjectFromAsset, createRoom } from "@/lib/room-schema";

// Starter room layouts a creator can apply in one click. Templates compose only
// EXISTING room-ready catalog assets (no generated graphics) and obey the same
// placement/validation rules as every other edit — each step routes through
// addObjectFromAsset, so an asset that can't fit is simply skipped, never forced.

export type RoomTemplateId =
  | "creator"
  | "photographer"
  | "artist"
  | "developer"
  | "shop"
  | "podcast";

type Placement = { assetId: string; label: string; action: RoomActionType };

type TemplateDef = {
  id: RoomTemplateId;
  name: string;
  description: string;
  kind: RoomKind;
  placements: Placement[];
};

const TEMPLATES: TemplateDef[] = [
  {
    id: "creator",
    name: "Creator",
    description: "A warm all-rounder: featured work, your links, a place to sit, and a guestbook.",
    kind: "standard",
    placements: [
      { assetId: "ast-painting", label: "Featured work", action: "gallery" },
      { assetId: "ast-bookshelf", label: "My links", action: "link" },
      { assetId: "ast-sofa", label: "Cosy corner", action: "none" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
      { assetId: "ast-guestbook-table", label: "Sign my guestbook", action: "guestbook" },
    ],
  },
  {
    id: "photographer",
    name: "Photographer",
    description: "A gallery wall, a print, and a showreel screen for visitors to browse.",
    kind: "gallery",
    placements: [
      { assetId: "ast-photo-wall", label: "Gallery wall", action: "gallery" },
      { assetId: "ast-painting", label: "Featured print", action: "gallery" },
      { assetId: "ast-screen", label: "Showreel", action: "video" },
      { assetId: "ast-rug", label: "Rug", action: "none" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
      { assetId: "ast-guestbook-table", label: "Guestbook", action: "guestbook" },
    ],
  },
  {
    id: "artist",
    name: "Artist",
    description: "A studio: latest piece, sketch wall, prints for sale, and a commission desk.",
    kind: "gallery",
    placements: [
      { assetId: "ast-painting", label: "Latest piece", action: "gallery" },
      { assetId: "ast-photo-wall", label: "Sketches", action: "gallery" },
      { assetId: "ast-product-shelf", label: "Prints for sale", action: "product" },
      { assetId: "ast-desk", label: "Commission me", action: "contact" },
      { assetId: "ast-rug", label: "Rug", action: "none" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
    ],
  },
  {
    id: "developer",
    name: "Developer",
    description: "A focused studio: a project screen, a links shelf, and a contact desk.",
    kind: "studio",
    placements: [
      { assetId: "ast-screen", label: "Latest project", action: "link" },
      { assetId: "ast-bookshelf", label: "GitHub & links", action: "link" },
      { assetId: "ast-desk", label: "Get in touch", action: "contact" },
      { assetId: "ast-sofa", label: "Lounge", action: "none" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
    ],
  },
  {
    id: "shop",
    name: "Shop",
    description: "A storefront: a welcome piece, two product shelves, and a guestbook.",
    kind: "shop",
    placements: [
      { assetId: "ast-painting", label: "Welcome", action: "gallery" },
      { assetId: "ast-product-shelf", label: "New arrivals", action: "product" },
      { assetId: "ast-product-shelf", label: "Bestsellers", action: "product" },
      { assetId: "ast-guestbook-table", label: "Guestbook", action: "guestbook" },
      { assetId: "ast-rug", label: "Rug", action: "none" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
    ],
  },
  {
    id: "podcast",
    name: "Podcast",
    description: "A lounge to listen in: episode screen, a sofa, a contact desk, and links.",
    kind: "lounge",
    placements: [
      { assetId: "ast-screen", label: "Watch episodes", action: "video" },
      { assetId: "ast-sofa", label: "Pull up a seat", action: "none" },
      { assetId: "ast-desk", label: "Be a guest", action: "contact" },
      { assetId: "ast-bookshelf", label: "Episode links", action: "link" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
    ],
  },
];

export type RoomTemplate = {
  id: RoomTemplateId;
  name: string;
  description: string;
  kind: RoomKind;
};

/** The template catalogue (presentation metadata only) for the picker UI. */
export const ROOM_TEMPLATES: RoomTemplate[] = TEMPLATES.map(({ id, name, description, kind }) => ({
  id,
  name,
  description,
  kind,
}));

/** Build a furnished room for `address` from a template, using only existing
 * catalog assets and the standard placement rules. */
export function applyTemplate(templateId: RoomTemplateId, address: string): Room {
  const def = TEMPLATES.find((t) => t.id === templateId);
  if (!def) return createRoom(address);
  let room = createRoom(address, def.name, def.kind);
  for (const placement of def.placements) {
    const asset = getAsset(placement.assetId) as CatalogAsset | undefined;
    if (!asset) continue;
    room = addObjectFromAsset(room, asset, placement.label, { type: placement.action });
  }
  return room;
}
