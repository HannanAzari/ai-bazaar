import type { CatalogAsset, Room, RoomActionData, RoomActionType, RoomKind } from "@/lib/types";
import { getAsset } from "@/lib/assets";
import { addObjectFromAsset, createRoom } from "@/lib/room-schema";

// Starter room layouts a creator can apply in one click. Templates compose only
// EXISTING room-ready catalog assets (no generated graphics) and obey the same
// placement/validation rules as every other edit — each step routes through
// addObjectFromAsset, so an asset that can't fit is simply skipped, never forced.
//
// V3: presets populate WORKING objects — each interactive object carries sample
// action data (gallery images, a video, a product, a contact, a profile) so a
// freshly applied room is immediately explorable. Owners then swap in their own
// content via the studio inspector.

export type RoomTemplateId =
  | "creator"
  | "photographer"
  | "artist"
  | "developer"
  | "shop"
  | "podcast";

type Placement = { assetId: string; label: string; action: RoomActionType; data?: RoomActionData };

type TemplateDef = {
  id: RoomTemplateId;
  name: string;
  description: string;
  kind: RoomKind;
  placements: Placement[];
};

// Sample media for the working presets. Picsum serves real placeholder images;
// owners replace these with their own in the studio.
const img = (seed: string, w = 800, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const SAMPLE_VIDEO = "https://www.youtube.com/watch?v=ysz5S6PUM-U";

const TEMPLATES: TemplateDef[] = [
  {
    id: "creator",
    name: "Creator",
    description: "A warm all-rounder: a portrait, featured work, your links, and a guestbook.",
    kind: "standard",
    placements: [
      { assetId: "ast-painting", label: "Featured work", action: "gallery", data: { images: [
        { src: img("creator-1"), caption: "A piece I'm proud of" },
        { src: img("creator-2"), caption: "Work in progress" },
        { src: img("creator-3"), caption: "From the archive" },
      ] } },
      { assetId: "ast-avatar-portrait", label: "About me", action: "profile" },
      { assetId: "ast-bookshelf", label: "My links", action: "link", data: { title: "Everything I make", url: "https://example.com", description: "Newsletter, shop, and socials in one place." } },
      { assetId: "ast-sofa", label: "Cosy corner", action: "none" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
      { assetId: "ast-guestbook-table", label: "Sign my guestbook", action: "guestbook" },
    ],
  },
  {
    id: "photographer",
    name: "Photographer",
    description: "A gallery wall, a featured print, and a showreel for visitors to browse.",
    kind: "gallery",
    placements: [
      { assetId: "ast-photo-wall", label: "Gallery wall", action: "gallery", data: { images: [
        { src: img("photo-1"), caption: "Golden hour" },
        { src: img("photo-2"), caption: "City in the rain" },
        { src: img("photo-3"), caption: "Portrait series" },
        { src: img("photo-4"), caption: "On the road" },
      ] } },
      { assetId: "ast-painting", label: "Featured print", action: "gallery", data: { images: [
        { src: img("photo-print-1"), caption: "Limited edition print" },
      ] } },
      { assetId: "ast-screen", label: "Showreel", action: "video", data: { url: SAMPLE_VIDEO, text: "A two-minute look at recent work." } },
      { assetId: "ast-rug", label: "Rug", action: "none" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
      { assetId: "ast-guestbook-table", label: "Guestbook", action: "guestbook" },
    ],
  },
  {
    id: "artist",
    name: "Artist",
    description: "A studio: latest piece, sketch wall, prints for sale, and an achievements board.",
    kind: "gallery",
    placements: [
      { assetId: "ast-painting", label: "Latest piece", action: "gallery", data: { images: [
        { src: img("artist-1"), caption: "Oil on canvas, 2026" },
        { src: img("artist-2"), caption: "Detail" },
      ] } },
      { assetId: "ast-photo-wall", label: "Sketches", action: "gallery", data: { images: [
        { src: img("artist-sketch-1"), caption: "Morning studies" },
        { src: img("artist-sketch-2"), caption: "Figure work" },
      ] } },
      { assetId: "ast-achievement-board", label: "About the artist", action: "profile" },
      { assetId: "ast-product-shelf", label: "Prints for sale", action: "product", data: { title: "Signed A2 print", price: "$45", image: img("artist-print", 600, 600), url: "https://example.com/shop" } },
      { assetId: "ast-desk", label: "Commission me", action: "contact", data: { email: "studio@example.com", website: "example.com" } },
      { assetId: "ast-rug", label: "Rug", action: "none" },
    ],
  },
  {
    id: "developer",
    name: "Developer",
    description: "A focused studio: a project screen, a certificate, a links shelf, and a contact desk.",
    kind: "studio",
    placements: [
      { assetId: "ast-screen", label: "Latest project", action: "link", data: { title: "My latest project", url: "https://github.com", description: "Source, docs, and a live demo." } },
      { assetId: "ast-certificate", label: "About me", action: "profile" },
      { assetId: "ast-bookshelf", label: "GitHub & links", action: "link", data: { title: "Find me online", url: "https://github.com", description: "GitHub, blog, and talks." } },
      { assetId: "ast-desk", label: "Get in touch", action: "contact", data: { email: "hi@example.com", website: "example.com", socials: [{ label: "GitHub", url: "https://github.com" }] } },
      { assetId: "ast-sofa", label: "Lounge", action: "none" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
    ],
  },
  {
    id: "shop",
    name: "Shop",
    description: "A storefront: a welcome piece, two product displays, and a guestbook.",
    kind: "shop",
    placements: [
      { assetId: "ast-painting", label: "Welcome", action: "gallery", data: { images: [
        { src: img("shop-hero"), caption: "New season is here" },
      ] } },
      { assetId: "ast-product-shelf", label: "New arrivals", action: "product", data: { title: "Hand-thrown mug", price: "$28", image: img("shop-mug", 600, 600), url: "https://example.com/shop/mug" } },
      { assetId: "ast-display-table", label: "Bestseller", action: "product", data: { title: "Linen apron", price: "$54", image: img("shop-apron", 600, 600), url: "https://example.com/shop/apron" } },
      { assetId: "ast-guestbook-table", label: "Guestbook", action: "guestbook" },
      { assetId: "ast-rug", label: "Rug", action: "none" },
      { assetId: "ast-plant", label: "Plant", action: "none" },
    ],
  },
  {
    id: "podcast",
    name: "Podcast",
    description: "A lounge to listen in: an episode screen, a booking desk, and episode links.",
    kind: "lounge",
    placements: [
      { assetId: "ast-screen", label: "Watch episodes", action: "video", data: { url: SAMPLE_VIDEO, text: "The latest episode." } },
      { assetId: "ast-sofa", label: "Pull up a seat", action: "none" },
      { assetId: "ast-desk", label: "Be a guest", action: "booking", data: { url: "https://calendly.com/example/podcast", text: "Pitch yourself as a guest." } },
      { assetId: "ast-bookshelf", label: "Episode links", action: "link", data: { title: "Listen everywhere", url: "https://example.com/listen", description: "Apple, Spotify, and RSS." } },
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
    room = addObjectFromAsset(room, asset, placement.label, { type: placement.action, data: placement.data });
  }
  return room;
}
