import type {
  AssetCategory,
  CatalogAsset,
  Room,
  RoomActionType,
  RoomKind,
  RoomObject,
  RoomZoneDef,
  RoomZoneType,
  Shop,
} from "@/lib/types";
import { getAsset, roomReadyAssets } from "@/lib/assets";

// The V1 room is a fixed nine-zone template. Anchors are normalised points
// (0..1) across the whole canvas, so a stored object renders identically
// without per-zone geometry. Zones add semantics: which categories belong
// where, and how many objects fit.

export const ROOM_ACTION_TYPES: RoomActionType[] = [
  "link", "video", "product", "booking", "contact", "gallery", "guestbook", "collection", "none",
];

export const zoneLabels: Record<RoomZoneType, string> = {
  back_wall: "Back wall",
  left_wall: "Left wall",
  right_wall: "Right wall",
  floor_left: "Floor — left",
  floor_center: "Floor — centre",
  floor_right: "Floor — right",
  shelf: "Shelf",
  window: "Window",
  door: "Door",
};

export const actionLabels: Record<RoomActionType, string> = {
  link: "Open link",
  video: "Play video",
  product: "View product",
  booking: "Book a time",
  contact: "Contact",
  gallery: "Open gallery",
  guestbook: "Sign guestbook",
  collection: "Save to collection",
  none: "No action",
};

const WALL: AssetCategory[] = ["decor", "wall"];
const FLOOR: AssetCategory[] = ["furniture", "plant", "structure", "floor"];

/** The canonical zone template. Cloned into every room. */
export const ZONE_TEMPLATE: RoomZoneDef[] = [
  { id: "back_wall", type: "back_wall", allowedCategories: WALL, maxObjects: 3, anchors: [
    { id: "bw-1", x: 0.30, y: 0.22 }, { id: "bw-2", x: 0.50, y: 0.19 }, { id: "bw-3", x: 0.70, y: 0.22 },
  ] },
  { id: "left_wall", type: "left_wall", allowedCategories: WALL, maxObjects: 2, anchors: [
    { id: "lw-1", x: 0.10, y: 0.30 }, { id: "lw-2", x: 0.13, y: 0.50 },
  ] },
  { id: "right_wall", type: "right_wall", allowedCategories: WALL, maxObjects: 2, anchors: [
    { id: "rw-1", x: 0.90, y: 0.30 }, { id: "rw-2", x: 0.87, y: 0.50 },
  ] },
  { id: "shelf", type: "shelf", allowedCategories: ["decor", "plant"], maxObjects: 3, anchors: [
    { id: "sh-1", x: 0.36, y: 0.44 }, { id: "sh-2", x: 0.50, y: 0.43 }, { id: "sh-3", x: 0.64, y: 0.44 },
  ] },
  { id: "window", type: "window", allowedCategories: ["decor"], maxObjects: 1, anchors: [
    { id: "wn-1", x: 0.50, y: 0.30 },
  ] },
  { id: "floor_left", type: "floor_left", allowedCategories: FLOOR, maxObjects: 2, anchors: [
    { id: "fl-1", x: 0.16, y: 0.74 }, { id: "fl-2", x: 0.27, y: 0.82 },
  ] },
  { id: "floor_center", type: "floor_center", allowedCategories: FLOOR, maxObjects: 2, anchors: [
    { id: "fc-1", x: 0.45, y: 0.80 }, { id: "fc-2", x: 0.56, y: 0.86 },
  ] },
  { id: "floor_right", type: "floor_right", allowedCategories: FLOOR, maxObjects: 2, anchors: [
    { id: "fr-1", x: 0.84, y: 0.74 }, { id: "fr-2", x: 0.73, y: 0.82 },
  ] },
  { id: "door", type: "door", allowedCategories: ["structure"], maxObjects: 1, anchors: [
    { id: "dr-1", x: 0.86, y: 0.60 },
  ] },
];

export function cloneZones(): RoomZoneDef[] {
  return ZONE_TEMPLATE.map((zone) => ({ ...zone, anchors: zone.anchors.map((a) => ({ ...a })) }));
}

export function findZone(room: Room, zoneId: string): RoomZoneDef | undefined {
  return room.zones.find((zone) => zone.id === zoneId);
}

export function isRoomActionType(value: string): value is RoomActionType {
  return (ROOM_ACTION_TYPES as string[]).includes(value);
}

/** Is `category` allowed in `zoneId`, and is the zone not already full? */
export function validatePlacement(room: Room, category: AssetCategory, zoneId: string, ignoreObjectId?: string): boolean {
  const zone = findZone(room, zoneId);
  if (!zone) return false;
  if (!zone.allowedCategories.includes(category)) return false;
  const count = room.objects.filter((o) => o.zoneId === zoneId && o.id !== ignoreObjectId).length;
  if (zone.maxObjects !== undefined && count >= zone.maxObjects) return false;
  return true;
}

/** First zone (and free anchor) an asset can legally occupy. */
export function firstCompatibleSlot(room: Room, asset: CatalogAsset): { zoneId: string; anchorId: string } | null {
  const zones = asset.compatibleZones ?? [];
  for (const zoneType of zones) {
    const zone = findZone(room, zoneType);
    if (!zone) continue;
    if (!validatePlacement(room, asset.category, zone.id)) continue;
    const usedAnchors = new Set(room.objects.filter((o) => o.zoneId === zone.id).map((o) => o.anchorId));
    const free = zone.anchors.find((a) => !usedAnchors.has(a.id)) ?? zone.anchors[0];
    return { zoneId: zone.id, anchorId: free.id };
  }
  return null;
}

let counter = 0;
function nextObjectId(): string {
  counter += 1;
  return `obj-${Date.now().toString(36)}-${counter}`;
}

const topZ = (room: Room) => room.objects.reduce((max, o) => Math.max(max, o.zIndex), 0);

/** Build an empty room from the zone template. */
export function createRoom(shopAddress: string, name = "Main room", type: RoomKind = "standard"): Room {
  return {
    id: `room-${shopAddress}`,
    shopAddress,
    name,
    type,
    theme: "warm",
    background: "standard",
    zones: cloneZones(),
    objects: [],
  };
}

// ── Pure layout helpers (return a new Room) ──────────────────

export function addObjectFromAsset(room: Room, asset: CatalogAsset, label?: string, action?: { type: RoomActionType; data?: { url?: string; text?: string } }): Room {
  const slot = firstCompatibleSlot(room, asset);
  if (!slot) return room;
  const object: RoomObject = {
    id: nextObjectId(),
    assetId: asset.id,
    zoneId: slot.zoneId,
    anchorId: slot.anchorId,
    x: 0,
    y: 0,
    scale: asset.defaultScale ?? 1,
    rotation: 0,
    zIndex: topZ(room) + 1,
    label: label ?? asset.name,
    actionType: action?.type ?? asset.defaultActionType ?? "none",
    actionData: action?.data,
    tags: [],
    hidden: false,
  };
  return { ...room, objects: [...room.objects, object] };
}

export function updateObject(room: Room, objectId: string, patch: Partial<RoomObject>): Room {
  return { ...room, objects: room.objects.map((o) => (o.id === objectId ? { ...o, ...patch } : o)) };
}

/** Move an object to a different zone/anchor, only if the target accepts it. */
export function moveObject(room: Room, objectId: string, zoneId: string, anchorId: string): Room {
  const object = room.objects.find((o) => o.id === objectId);
  if (!object) return room;
  const asset = getAsset(object.assetId);
  const category = asset?.category;
  if (category && !validatePlacement(room, category, zoneId, objectId)) return room;
  return updateObject(room, objectId, { zoneId, anchorId });
}

// ── Free drag + resize (V2) ──────────────────────────────────

/** Inset (normalised) kept between an object's centre and the room edge so a
 * dragged object always stays inside the room. */
export const ROOM_BOUND_MARGIN = 0.04;
/** Smallest object box side, in canvas pixels — resize never goes to zero. */
export const MIN_OBJECT_SIZE = 16;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Free-drag an object to a normalised centre (anchor + offset), clamping the
 * centre inside the room bounds so it can never leave the canvas. Keeps the
 * object's zone (and therefore its category validity) intact — drag only
 * adjusts the fine offset from the anchor.
 */
export function moveObjectTo(room: Room, objectId: string, centerX: number, centerY: number): Room {
  const object = room.objects.find((o) => o.id === objectId);
  if (!object) return room;
  const zone = findZone(room, object.zoneId);
  const anchor = zone?.anchors.find((a) => a.id === object.anchorId) ?? zone?.anchors[0];
  const ax = anchor?.x ?? 0.5;
  const ay = anchor?.y ?? 0.5;
  const cx = clamp(centerX, ROOM_BOUND_MARGIN, 1 - ROOM_BOUND_MARGIN);
  const cy = clamp(centerY, ROOM_BOUND_MARGIN, 1 - ROOM_BOUND_MARGIN);
  return updateObject(room, objectId, { x: cx - ax, y: cy - ay });
}

/** The current normalised centre (anchor + offset) of an object. */
export function objectCenter(room: Room, object: RoomObject): { x: number; y: number } {
  const zone = findZone(room, object.zoneId);
  const anchor = zone?.anchors.find((a) => a.id === object.anchorId) ?? zone?.anchors[0];
  return { x: (anchor?.x ?? 0.5) + object.x, y: (anchor?.y ?? 0.5) + object.y };
}

/**
 * Resize an object. Any dimension that is zero or negative is rejected and the
 * whole operation is a no-op (the room is returned unchanged), so the engine
 * never persists an invalid size. `scale` is the uniform multiplier (slider);
 * `width`/`height` are the box dimensions (corner handles).
 */
export function resizeObject(
  room: Room,
  objectId: string,
  dims: { width?: number; height?: number; scale?: number },
): Room {
  const object = room.objects.find((o) => o.id === objectId);
  if (!object) return room;
  const patch: Partial<RoomObject> = {};
  if (dims.scale !== undefined) {
    if (!(dims.scale > 0)) return room;
    patch.scale = dims.scale;
  }
  if (dims.width !== undefined) {
    if (!(dims.width > 0)) return room;
    patch.width = dims.width;
  }
  if (dims.height !== undefined) {
    if (!(dims.height > 0)) return room;
    patch.height = dims.height;
  }
  return updateObject(room, objectId, patch);
}

export function duplicateObject(room: Room, sourceId: string): Room {
  const object = room.objects.find((o) => o.id === sourceId);
  if (!object) return room;
  const copy: RoomObject = { ...object, id: nextObjectId(), x: object.x + 0.02, y: object.y + 0.02, zIndex: topZ(room) + 1 };
  return { ...room, objects: [...room.objects, copy] };
}

export function deleteObject(room: Room, objectId: string): Room {
  return { ...room, objects: room.objects.filter((o) => o.id !== objectId) };
}

export function bringToFront(room: Room, objectId: string): Room {
  return updateObject(room, objectId, { zIndex: topZ(room) + 1 });
}

export function sendToBack(room: Room, objectId: string): Room {
  const minZ = room.objects.reduce((min, o) => Math.min(min, o.zIndex), 0);
  return updateObject(room, objectId, { zIndex: minZ - 1 });
}

/** Swap z-index with the neighbour one step above (Bring Forward). */
export function bringForward(room: Room, objectId: string): Room {
  const sorted = [...room.objects].sort((a, b) => a.zIndex - b.zIndex);
  const idx = sorted.findIndex((o) => o.id === objectId);
  if (idx < 0 || idx === sorted.length - 1) return room;
  const cur = sorted[idx];
  const above = sorted[idx + 1];
  return {
    ...room,
    objects: room.objects.map((o) =>
      o.id === cur.id ? { ...o, zIndex: above.zIndex } : o.id === above.id ? { ...o, zIndex: cur.zIndex } : o,
    ),
  };
}

/** Swap z-index with the neighbour one step below (Send Backward). */
export function sendBackward(room: Room, objectId: string): Room {
  const sorted = [...room.objects].sort((a, b) => a.zIndex - b.zIndex);
  const idx = sorted.findIndex((o) => o.id === objectId);
  if (idx <= 0) return room;
  const cur = sorted[idx];
  const below = sorted[idx - 1];
  return {
    ...room,
    objects: room.objects.map((o) =>
      o.id === cur.id ? { ...o, zIndex: below.zIndex } : o.id === below.id ? { ...o, zIndex: cur.zIndex } : o,
    ),
  };
}

/**
 * Build a populated default room for a house from its decorations + links, so
 * every public house shows a furnished, interactive room even before its owner
 * edits one.
 */
export function deriveDefaultRoom(shop: Shop): Room {
  let room = createRoom(shop.address, `${shop.name}`, "standard");
  const ready = roomReadyAssets();
  const byId = (id: string) => ready.find((a) => a.id === id);

  const painting = byId("ast-painting");
  const screen = byId("ast-screen");
  const bookshelf = byId("ast-bookshelf");
  const rug = byId("ast-rug");
  const sofa = byId("ast-sofa");
  const plant = byId("ast-plant");
  const guestbookTable = byId("ast-guestbook-table");
  const door = byId("ast-door");

  // Decorations become wall art / screens.
  const wallDecos = shop.decorations.filter((d) => d.type === "image" || d.type === "ai-image");
  if (painting && wallDecos[0]) room = addObjectFromAsset(room, painting, wallDecos[0].title, { type: "gallery" });
  if (screen && wallDecos[1]) room = addObjectFromAsset(room, screen, wallDecos[1].title, { type: "video" });
  if (painting && !wallDecos.length) room = addObjectFromAsset(room, painting, "Gallery", { type: "gallery" });

  // Links live on a bookshelf.
  if (bookshelf) {
    const firstLink = shop.links[0];
    room = addObjectFromAsset(room, bookshelf, firstLink?.label ?? "Links", firstLink ? { type: "link", data: { url: firstLink.url } } : { type: "none" });
  }

  if (rug) room = addObjectFromAsset(room, rug, "Rug", { type: "none" });
  if (sofa) room = addObjectFromAsset(room, sofa, "Sofa", { type: "none" });
  if (plant) room = addObjectFromAsset(room, plant, "Plant", { type: "none" });
  if (guestbookTable) room = addObjectFromAsset(room, guestbookTable, "Guestbook", { type: "guestbook" });
  if (door) room = addObjectFromAsset(room, door, "Out the side door", { type: "none" });

  return room;
}
