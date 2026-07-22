import { addObjectFromAsset, createRoom } from "@/lib/room-schema";
import { interiorV1Assets } from "@/lib/asset-catalogs";
import type { CatalogAsset, Room } from "@/lib/types";

// Interior V1 visual test slice (ADR-021): a deterministic engine Room furnished
// with the real approved Style Lab assets, rendered in the **original room-engine
// shell** (RoomCanvas). Placement goes through the standard zone/anchor pipeline
// (addObjectFromAsset), so the room is valid by construction; the image-first
// renderer shows the real PNGs. Asset picks are by role so they survive the
// Factory re-exporting with different id suffixes.

export const INTERIOR_V1_TEST_ADDRESS = "nestudio.interior.v1";

const byId = (a: CatalogAsset, b: CatalogAsset) => a.id.localeCompare(b.id);
const firstNamed = (re: RegExp) => interiorV1Assets.filter((a) => re.test(a.name)).sort(byId)[0];
const allNamed = (re: RegExp) => interiorV1Assets.filter((a) => re.test(a.name)).sort(byId);

/** Pick the hero pieces by role (deterministic, id-suffix agnostic). */
export function pickInteriorAssets() {
  const chairs = allNamed(/chair/i);
  return {
    sofa: firstNamed(/sofa/i),
    table: firstNamed(/table/i),
    desk: firstNamed(/desk/i),
    chairLeft: chairs[0],
    chairRight: chairs[1] ?? chairs[0],
  };
}

// Per-role render scale so the real furniture reads at a believable size inside
// the existing shell (the engine's default scales are tuned for icon sprites).
const PLAN: { role: keyof ReturnType<typeof pickInteriorAssets>; label: string; scale: number }[] = [
  { role: "sofa", label: "Sofa", scale: 2.2 },
  { role: "chairLeft", label: "Reading Chair", scale: 1.5 },
  { role: "table", label: "Coffee Table", scale: 1.7 },
  { role: "desk", label: "Desk", scale: 1.8 },
];

/** A deterministic engine room furnished with the real assets, for the shell + tests. */
export function buildInteriorV1TestRoom(address = INTERIOR_V1_TEST_ADDRESS): Room {
  const picks = pickInteriorAssets();
  let room = createRoom(address, "Nestudio Interior V1 Test Room", "lounge", `room-${address}`);

  const scaleByAssetId = new Map<string, number>();
  for (const item of PLAN) {
    const asset = picks[item.role];
    if (!asset) continue;
    room = addObjectFromAsset(room, asset, item.label);
    scaleByAssetId.set(asset.id, item.scale);
  }

  // Stable ids + readable per-role scale (zone/anchor placement is unchanged).
  return {
    ...room,
    objects: room.objects.map((object, index) => ({
      ...object,
      id: `obj-int-${index + 1}-${object.assetId}`,
      scale: scaleByAssetId.get(object.assetId) ?? object.scale,
    })),
  };
}
