"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { nestBackend } from "@/lib/nest-repo";
import * as social from "@/lib/nest/supabase-social-repo";
import {
  followerCount as localFollowerCount,
  isFollowing as localIsFollowing,
  onSocialChanged,
  toggleFollow as localToggleFollow,
} from "@/lib/nest-social";
import * as store from "@/lib/nest-social-store";

// ── M24 §8 — one creator's follow state, shared by every surface ─────────────
//
// The Follow button, the creator drawer, the creator's Profile and any visible creator
// card all read this. Because they share one store entry, pressing Follow anywhere moves
// the follower count everywhere in the same tick — which is the specific thing the
// founder reported as broken ("Follow does not immediately update follower counts on
// Profile").

const EMPTY: store.CreatorSocialCounts = { followerCount: 0, following: false };
const isSupabase = () => nestBackend() === "supabase";

export type CreatorSocial = {
  followerCount: number;
  following: boolean;
  /** Optimistic follow/unfollow. Rolls back and returns false if persistence fails. */
  setFollowing: (next: boolean, viewerId?: string) => Promise<boolean>;
  reload: () => void;
};

export function useCreatorSocial(creatorId?: string): CreatorSocial {
  const { ownerId } = useNestIdentity();

  const counts = useSyncExternalStore(
    store.subscribe,
    () => (creatorId ? store.getCreatorCounts(creatorId) ?? EMPTY : EMPTY),
    () => EMPTY,
  );

  const load = useCallback(async () => {
    if (!creatorId) return;
    if (!isSupabase()) {
      store.setCreatorCounts(creatorId, {
        followerCount: localFollowerCount(creatorId),
        following: localIsFollowing(ownerId, creatorId),
      });
      return;
    }
    try {
      const [followerCount, following] = await Promise.all([
        social.followerCount(creatorId),
        ownerId ? social.isFollowing(ownerId, creatorId) : Promise.resolve(false),
      ]);
      store.setCreatorCounts(creatorId, { followerCount, following });
    } catch {
      // A follower count that can't load is not worth blocking a page for; the button
      // stays usable and reconciles on the next load.
      if (!store.getCreatorCounts(creatorId)) store.setCreatorCounts(creatorId, EMPTY);
    }
  }, [creatorId, ownerId]);

  useEffect(() => {
    void load();
    if (!isSupabase()) return onSocialChanged(() => void load());
  }, [load]);

  const setFollowing = useCallback(
    async (next: boolean, viewerId?: string): Promise<boolean> => {
      const viewer = viewerId ?? ownerId;
      if (!creatorId || !viewer || viewer === creatorId) return false;

      if (!isSupabase()) {
        localToggleFollow(viewer, creatorId);
        return true;
      }

      const previous = store.getCreatorCounts(creatorId);
      store.applyFollow(creatorId, next); // optimistic — every subscriber moves now
      try {
        await social.setFollowing(viewer, creatorId, next);
        return true;
      } catch {
        store.revertCreator(creatorId, previous); // never leave "Following" over nothing
        return false;
      }
    },
    [creatorId, ownerId],
  );

  return { ...counts, setFollowing, reload: () => void load() };
}
