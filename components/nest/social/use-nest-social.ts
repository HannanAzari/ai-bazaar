"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { nestBackend } from "@/lib/nest-repo";
import * as social from "@/lib/nest/supabase-social-repo";
import {
  commentCount as localCommentCount,
  isLiked as localIsLiked,
  likeCount as localLikeCount,
  onSocialChanged,
  toggleLike as localToggleLike,
} from "@/lib/nest-social";
import * as store from "@/lib/nest-social-store";

// ── M23B §7 — one hook behind Like / Comments ────────────────────────────────
//
// Likes and comment counts for a single Nest, keyed by its stable slug. On the Supabase
// backend this is the shared `nest_likes` / `nest_comments` tables, so Account A sees the
// like Account B left. On the local/demo backend it is the old localStorage layer,
// untouched.
//
// The like is OPTIMISTIC: the heart fills on tap and the count moves immediately, then
// the write is reconciled. If the write fails, the optimistic state is rolled back and
// the error surfaced — the one thing we never do is leave a filled heart over a like
// that does not exist.

const isSupabase = () => nestBackend() === "supabase";

export type NestSocial = {
  likeCount: number;
  liked: boolean;
  commentCount: number;
  loading: boolean;
  error: string | null;
  /** Returns false when the viewer is a guest, so the caller can open the auth gate. */
  toggleLike: () => Promise<boolean>;
  /** Called by the comment sheet after it posts/deletes, to re-sync the rail's count. */
  refresh: () => void;
};

const EMPTY: store.NestSocialCounts = { likeCount: 0, liked: false, commentCount: 0 };

export function useNestSocial(nestSlug: string, nestOwnerId?: string, nestTitle?: string): NestSocial {
  const { ownerId } = useNestIdentity();
  const inFlight = useRef(false);
  const errorRef = useRef<string | null>(null);
  const loadingRef = useRef(true);

  // M24 §8 — read through the SHARED store. Every surface showing this Nest (Home card,
  // full Nest, drawer, Profile preview) subscribes to the same entry, so one tap moves
  // all of them in the same tick instead of each waiting for its own refetch.
  store.getVersion(); // referenced so the dependency is obvious to readers
  const counts = useSyncExternalStore(
    store.subscribe,
    () => store.getNestCounts(nestSlug) ?? EMPTY,
    () => EMPTY,
  );

  const load = useCallback(async () => {
    if (!isSupabase()) {
      store.setNestCounts(nestSlug, {
        likeCount: localLikeCount(nestSlug),
        liked: localIsLiked(nestSlug, ownerId),
        commentCount: localCommentCount(nestSlug),
      });
      loadingRef.current = false;
      return;
    }
    try {
      const s = await social.loadSocialState(nestSlug, ownerId);
      errorRef.current = null;
      store.setNestCounts(nestSlug, s);
    } catch (e) {
      errorRef.current = e instanceof Error ? e.message : "Engagement could not be loaded.";
    } finally {
      loadingRef.current = false;
    }
  }, [nestSlug, ownerId]);

  const refresh = useCallback(() => { void load(); }, [load]);

  useEffect(() => {
    loadingRef.current = true;
    void load();
    if (!isSupabase()) return onSocialChanged(() => void load());
  }, [load]);

  const toggleLike = useCallback(async (): Promise<boolean> => {
    if (!ownerId) return false; // guest → caller opens the auth gate
    if (inFlight.current) return true;

    if (!isSupabase()) {
      localToggleLike(nestSlug, ownerId);
      return true;
    }

    inFlight.current = true;
    const previous = store.getNestCounts(nestSlug);
    const next = store.applyLike(nestSlug, !(previous?.liked ?? false)); // optimistic, everywhere
    errorRef.current = null;
    try {
      if (next?.liked) await social.like(nestSlug, ownerId, nestOwnerId, nestTitle);
      else await social.unlike(nestSlug, ownerId);
    } catch (e) {
      store.revertNest(nestSlug, previous); // never show a like that didn't persist
      errorRef.current = e instanceof Error ? e.message : "Your like could not be saved.";
    } finally {
      inFlight.current = false;
    }
    return true;
  }, [ownerId, nestSlug, nestOwnerId, nestTitle]);

  return { ...counts, loading: loadingRef.current, error: errorRef.current, toggleLike, refresh };
}
