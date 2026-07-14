// ── M20 — bridge: AI inventory ⇄ Nest Editor catalog ─────────────────────────
//
// Maps engine-native InventoryAsset records into the editor's LivingNestAsset
// contract so approved AI assets appear in the picker's tray AND resolve by id on
// the canvas (a placed object looks its image up in `assetsById`). Kept OUT of
// lib/ai-inventory so the inventory stays editor-agnostic and reusable by every
// studio; this adapter is the only place the two worlds meet.

"use client";

import { useMemo } from "react";
import { CURRENT_NEST_DNA_VERSION, NEST_CAMERA_CONTRACT_VERSION, type NestAssetCategory } from "@/lib/nest-types";
import type { LivingNestAsset, LivingNestSlotType } from "@/lib/nest-visual-types";
import type { AssetKind } from "@/lib/ai/types";
import type { InventoryAsset } from "@/lib/ai-inventory/types";
import { useInventory } from "@/lib/ai-inventory/react";

/** Each AI kind → the library's asset category (the "AI" grouping is a separate
 *  virtual category keyed on source/tags, so these stay natural). */
function categoryForKind(kind: AssetKind): NestAssetCategory {
  switch (kind) {
    case "furniture":
      return "furniture";
    case "decoration":
      return "decor";
    case "avatar":
      return "avatar";
    default:
      return "personal";
  }
}

/** Where each kind sits in a room (drives plane + classification). */
function slotForKind(kind: AssetKind): LivingNestSlotType[] {
  switch (kind) {
    case "furniture":
      return ["table"]; // floor-standing object
    case "decoration":
      return ["books"]; // decor
    case "avatar":
      return ["avatar"];
    default:
      return []; // background / house — no floor slot
  }
}

/** InventoryAsset → LivingNestAsset. The transparent PNG data URL flows straight
 *  through as imageUrl/thumbnail/cutout — the canvas + drawer render it as-is. */
export function inventoryAssetToLiving(a: InventoryAsset): LivingNestAsset {
  return {
    id: a.id,
    name: a.name,
    category: categoryForKind(a.kind),
    tags: Array.from(new Set(["ai", ...a.tags])),
    dnaVersion: CURRENT_NEST_DNA_VERSION,
    cameraContractVersion: NEST_CAMERA_CONTRACT_VERSION,
    assetType: "standard",
    imageUrl: a.imageUrl,
    thumbnailUrl: a.imageUrl,
    transparentPngUrl: a.imageUrl,
    compatibleSlotTypes: slotForKind(a.kind),
    variants: [],
    states: [{ name: "idle" }],
    approvalStatus: "approved",
    source: "runtime_personal",
    createdAt: a.createdAt,
    updatedAt: a.createdAt,
  };
}

/** Reactive list of AI-inventory assets in editor form. Re-renders the editor
 *  catalog whenever the user approves or deletes an asset (also across tabs). */
export function useAiLivingAssets(): LivingNestAsset[] {
  const inventory = useInventory();
  return useMemo(() => inventory.map(inventoryAssetToLiving), [inventory]);
}
