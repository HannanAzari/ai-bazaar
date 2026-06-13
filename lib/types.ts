export type Bazaar = {
  id: string;
  slug: string;
  addressPrefix: string;
  name: string;
  subtitle: string;
  accent: string;
  soft: string;
  claimed: number;
  position: { x: number; y: number };
  /** Axial hex coordinate (q, r) on the district world map. */
  hex: { q: number; r: number };
};

export type ShopLink = {
  id: string;
  label: string;
  url: string;
  kind: "external" | "social";
  tags?: string[];
};

export type Decoration = {
  id: string;
  type: "text" | "image" | "ai-image" | "link" | "furniture";
  title: string;
  content: string;
  palette?: string;
  zone?: RoomZone;
  tags?: string[];
};

export type RoomZone = "left-wall" | "back-wall" | "floor" | "right-wall";

export type HouseExterior = {
  color: string;
  roofStyle: "gable" | "stepped" | "mansard" | "round";
  gardenStyle: "wildflowers" | "herbs" | "small-tree" | "minimal";
  signText: string;
  decoration?: string;
};

export type Shop = {
  id: string;
  address: string;
  bazaarId: string;
  slotNumber: number;
  name: string;
  owner: string;
  ownerHandle: string;
  tagline: string;
  bio: string;
  avatar: string;
  palette: string;
  cover: string;
  likes: number;
  followers: number;
  visitors: number;
  createdAt: string;
  links: ShopLink[];
  decorations: Decoration[];
  exterior?: HouseExterior;
  hidden?: boolean;
  tags?: string[];
};

export type GenerationJob = {
  id: string;
  prompt: string;
  status: "queued" | "building" | "complete" | "failed";
  createdAt: string;
};

// ── Analytics events ────────────────────────────────────────
export type EventType =
  | "house_view"
  | "room_view"
  | "decoration_click"
  | "object_click"
  | "link_click"
  | "share_click"
  | "follow"
  | "like"
  // Room studio (V2) editing lifecycle.
  | "room_object_added"
  | "room_object_deleted"
  | "room_object_moved"
  | "room_object_resized"
  | "room_template_applied"
  // Room V3 visitor object interactions.
  | "gallery_opened"
  | "video_opened"
  | "product_opened"
  | "booking_opened"
  | "contact_opened"
  | "profile_opened";

export type BazaarEvent = {
  id: string;
  type: EventType;
  /** The shop the event relates to, when applicable. */
  shopId?: string;
  /** A decoration or link id, when applicable. */
  targetId?: string;
  createdAt: string;
};

// ── Reporting / moderation ──────────────────────────────────
export type ReportTargetType = "house" | "decoration" | "user" | "guestbook";

export type ReportStatus = "pending" | "reviewed" | "hidden" | "dismissed";

export type Report = {
  id: string;
  targetType: ReportTargetType;
  /** Shop address for house/decoration/guestbook reports, owner handle for user reports. */
  targetRef: string;
  /** Decoration id, or guestbook entry id, depending on targetType. */
  targetId?: string;
  targetLabel: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
};

// ── Notifications ───────────────────────────────────────────
export type NotificationType =
  | "house_view"
  | "like"
  | "follow"
  | "guestbook_entry"
  | "item_click"
  | "report_status";

export type Notification = {
  id: string;
  type: NotificationType;
  /** Short headline, e.g. "New follower". */
  title: string;
  /** Supporting line, e.g. "Mina signed your guestbook". */
  body: string;
  /** Optional in-app destination for the notification. */
  href?: string;
  read: boolean;
  createdAt: string;
};

// ── Guestbook ───────────────────────────────────────────────
export type GuestbookEntry = {
  id: string;
  /** Address of the house the note was left at. */
  shopAddress: string;
  /** Visitor's display name. */
  name: string;
  message: string;
  /** Owner can soft-hide an entry without deleting its record. */
  hidden: boolean;
  createdAt: string;
};

// ── Collections ─────────────────────────────────────────────
export type SavedKind = "house" | "item";

export type Collection = {
  id: string;
  name: string;
  /** True for the three starter collections. */
  isDefault: boolean;
  createdAt: string;
};

export type CollectionItem = {
  id: string;
  collectionId: string;
  kind: SavedKind;
  /** Address of the saved house, or the house an item lives in. */
  shopAddress: string;
  /** Decoration id when kind is "item". */
  itemId?: string;
  label: string;
  createdAt: string;
};

// ── Activity feed ───────────────────────────────────────────
export type ActivityType =
  | "claimed_house"
  | "updated_house"
  | "added_decoration"
  | "liked_house"
  | "followed_creator"
  | "guestbook_entry"
  | "saved_to_collection";

export type ActivityEntry = {
  id: string;
  type: ActivityType;
  actorName: string;
  /** Bare handle (no @) for profile-specific filtering. */
  actorHandle: string;
  /** Human summary, e.g. "liked The Quiet Kettle". */
  summary: string;
  href?: string;
  createdAt: string;
};

// ── Asset catalog ───────────────────────────────────────────
export type AssetCategory = "furniture" | "wall" | "floor" | "plant" | "lighting" | "decor" | "structure";
export type AssetPlacement = "floor" | "wall" | "ceiling" | "exterior" | "any";
export type AssetRarity = "common" | "uncommon" | "rare" | "legendary";
export type AssetStatus = "draft" | "published" | "retired";
export type AssetOwnerType = "system" | "creator";

export type CatalogAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  /** Village id this asset themes to, or "any". */
  villageTheme: string;
  placement: AssetPlacement;
  ownerType: AssetOwnerType;
  /** Owner handle when creator-owned. */
  ownerHandle?: string;
  rarity: AssetRarity;
  tags: string[];
  /** Placeholder image URL — no real uploads in this foundation. */
  imageUrl: string;
  status: AssetStatus;
  // ── Room-engine metadata (present on room-ready assets) ──
  /** Zone types this asset may be placed in. */
  compatibleZones?: RoomZoneType[];
  /** Starting scale when first placed. */
  defaultScale?: number;
  /** Suggested action for a freshly placed object. */
  defaultActionType?: RoomActionType;
};

// ── Room engine (V1) ────────────────────────────────────────
// NOTE: distinct from the legacy `RoomZone` string-union used by decorations.
export type RoomZoneType =
  | "back_wall"
  | "left_wall"
  | "right_wall"
  | "floor_left"
  | "floor_center"
  | "floor_right"
  | "shelf"
  | "window"
  | "door";

export type RoomActionType =
  | "link"
  | "video"
  | "product"
  | "booking"
  | "contact"
  | "gallery"
  | "profile"
  | "guestbook"
  | "collection"
  | "none";

export type RoomKind = "studio" | "shop" | "gallery" | "lounge" | "standard";

/** A placement point inside the room, normalised 0..1 across the whole canvas. */
export type AnchorPoint = { id: string; x: number; y: number };

export type RoomZoneDef = {
  id: string;
  type: RoomZoneType;
  allowedCategories: AssetCategory[];
  anchors: AnchorPoint[];
  maxObjects?: number;
};

/** A single social handle/link shown in a contact panel. */
export type ContactSocial = { label: string; url: string };

/** A single image in a gallery object. */
export type GalleryImage = { src: string; caption?: string };

/**
 * Everything an object's action needs to do its job. All fields are optional and
 * stored as `jsonb` in `room_objects.action_data`, so the shape can grow without
 * a schema migration. Which fields matter depends on the object's `actionType`:
 * - link    → url, title, description
 * - video   → url (YouTube/Vimeo/local)
 * - gallery → images[]
 * - product → image, title, price, url
 * - booking → url (Calendly/external), text
 * - contact → email, website, phone, socials[]
 * - profile → (none; reuses the house owner's creator profile)
 */
export type RoomActionData = {
  url?: string;
  text?: string;
  title?: string;
  description?: string;
  // gallery
  images?: GalleryImage[];
  // product
  price?: string;
  image?: string;
  // contact
  email?: string;
  website?: string;
  phone?: string;
  socials?: ContactSocial[];
};

export type RoomObject = {
  id: string;
  assetId: string;
  /** Zone the object belongs to (zone id === zone type in the V1 template). */
  zoneId: string;
  anchorId: string;
  /** Fine offset from the anchor, normalised across the whole canvas. Free
   * dragging adjusts this; the rendered centre is anchor + offset, clamped to
   * the room bounds. */
  x: number;
  y: number;
  scale: number;
  /** Object box size in canvas pixels (corner-resize handles). Optional for
   * back-compat: rooms saved before V2 carry only `scale` and fall back to the
   * base tile size. `scale` multiplies width/height when both are present. */
  width?: number;
  height?: number;
  rotation: number;
  zIndex: number;
  label: string;
  actionType: RoomActionType;
  actionData?: RoomActionData;
  tags: string[];
  hidden: boolean;
};

export type Room = {
  id: string;
  /** The house this room belongs to. */
  shopAddress: string;
  name: string;
  type: RoomKind;
  theme: string;
  /** Wall/floor style key (reuses the existing room shell for V1). */
  background: string;
  zones: RoomZoneDef[];
  objects: RoomObject[];
};
