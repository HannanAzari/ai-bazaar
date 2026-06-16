import {
  type NestudioAssetCategory,
  type RoomZoneType,
  type RoomActionType,
  type AssetPlacement,
} from "@/lib/types";

// A self-contained mirror of the main app's nine-zone room template
// (lib/room-schema.ts ZONE_TEMPLATE). Kept in the factory — not imported — so the
// app stays decoupled. Used by both Nestudio import validation and the Room
// Designer Sandbox. Capacity-only placement (anchors aren't needed here).

export type ZoneDef = {
  type: RoomZoneType;
  label: string;
  allowedCategories: NestudioAssetCategory[];
  maxObjects: number;
};

const WALL: NestudioAssetCategory[] = ["decor", "wall"];
const FLOOR: NestudioAssetCategory[] = ["furniture", "plant", "structure", "floor", "stairs", "door"];

/** The canonical nine zones (allowed categories + capacity), mirroring ZONE_TEMPLATE. */
export const ZONE_DEFS: ZoneDef[] = [
  { type: "back_wall", label: "Back wall", allowedCategories: WALL, maxObjects: 3 },
  { type: "left_wall", label: "Left wall", allowedCategories: WALL, maxObjects: 2 },
  { type: "right_wall", label: "Right wall", allowedCategories: WALL, maxObjects: 2 },
  { type: "shelf", label: "Shelf", allowedCategories: ["decor", "plant"], maxObjects: 3 },
  { type: "window", label: "Window", allowedCategories: ["decor"], maxObjects: 1 },
  { type: "floor_left", label: "Floor — left", allowedCategories: FLOOR, maxObjects: 2 },
  { type: "floor_center", label: "Floor — centre", allowedCategories: FLOOR, maxObjects: 2 },
  { type: "floor_right", label: "Floor — right", allowedCategories: FLOOR, maxObjects: 2 },
  { type: "door", label: "Door", allowedCategories: ["structure", "door", "stairs"], maxObjects: 2 },
];

export const NESTUDIO_ZONE_TYPES: RoomZoneType[] = ZONE_DEFS.map((z) => z.type);

export const NESTUDIO_CATEGORIES: NestudioAssetCategory[] = [
  "furniture", "wall", "floor", "plant", "lighting", "decor", "structure", "door", "stairs",
];

export const NESTUDIO_PLACEMENTS: AssetPlacement[] = ["floor", "wall", "ceiling", "exterior", "any"];

export const NESTUDIO_ACTION_TYPES: RoomActionType[] = [
  "link", "video", "product", "booking", "contact", "gallery", "profile", "room_link", "guestbook", "collection", "none",
];

export function zoneDef(type: RoomZoneType): ZoneDef | undefined {
  return ZONE_DEFS.find((z) => z.type === type);
}

export function isKnownZone(type: string): type is RoomZoneType {
  return (NESTUDIO_ZONE_TYPES as string[]).includes(type);
}

/** Does any zone in the template accept this category? */
export function categoryHasZone(category: NestudioAssetCategory): boolean {
  return ZONE_DEFS.some((z) => z.allowedCategories.includes(category));
}

/** Is `category` allowed in `zoneType`? */
export function categoryAllowedInZone(category: NestudioAssetCategory, zoneType: RoomZoneType): boolean {
  const zone = zoneDef(zoneType);
  return !!zone && zone.allowedCategories.includes(category);
}
