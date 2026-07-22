"use client";

import { useEffect, useState } from "react";
import { CURRENT_NEST_DNA_VERSION, NEST_CAMERA_CONTRACT_VERSION } from "@/lib/nest-types";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import { getActiveAvatar, type UserAvatar } from "@/lib/avatar-factory/avatar-repo";

// Bridge: the signed-in user's ACTIVE avatar → an editor LivingNestAsset in the private
// "My Avatar" grouping (source:"runtime_avatar"). Renders from the active avatar's public
// output URL (already public as the profile avatar; the SOURCE photo stays private). Only
// the owner's own active avatar is ever loaded (RLS), and it never enters the global library.

export function activeAvatarToLiving(a: UserAvatar): LivingNestAsset {
  const url = a.publicProfileUrl ?? a.editorAssetUrl ?? "";
  return {
    id: `avatar-${a.id}`,
    name: a.title ?? "My Avatar",
    category: "avatar",
    tags: ["ai", "avatar", "mine"],
    dnaVersion: CURRENT_NEST_DNA_VERSION,
    cameraContractVersion: NEST_CAMERA_CONTRACT_VERSION,
    assetType: "avatar",
    imageUrl: url,
    thumbnailUrl: url,
    transparentPngUrl: url,
    compatibleSlotTypes: ["avatar"],
    variants: [],
    states: [{ name: "idle" }],
    approvalStatus: "approved",
    source: "runtime_avatar",
    createdAt: a.createdAt,
    updatedAt: a.createdAt,
  };
}

/** The signed-in user's active avatar as an editor asset (empty array if none / signed out). */
export function useMyAvatarLivingAsset(): LivingNestAsset[] {
  const [assets, setAssets] = useState<LivingNestAsset[]>([]);
  useEffect(() => {
    let alive = true;
    void getActiveAvatar().then((a) => { if (alive && a && (a.publicProfileUrl || a.editorAssetUrl)) setAssets([activeAvatarToLiving(a)]); });
    return () => { alive = false; };
  }, []);
  return assets;
}
