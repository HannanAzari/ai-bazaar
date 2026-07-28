"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export function useNestSocial(nestSlug: string, nestOwnerId?: string, nestTitle?: string): NestSocial {
  const { ownerId } = useNestIdentity();
  const [state, setState] = useState({ likeCount: 0, liked: false, commentCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const inFlight = useRef(false);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!isSupabase()) {
      const sync = () =>
        setState({
          likeCount: localLikeCount(nestSlug),
          liked: localIsLiked(nestSlug, ownerId),
          commentCount: localCommentCount(nestSlug),
        });
      sync();
      setLoading(false);
      return onSocialChanged(sync);
    }

    let alive = true;
    setLoading(true);
    void social
      .loadSocialState(nestSlug, ownerId)
      .then((s) => {
        if (!alive) return;
        setError(null);
        setState(s);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Engagement could not be loaded.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [nestSlug, ownerId, nonce]);

  const toggleLike = useCallback(async (): Promise<boolean> => {
    if (!ownerId) return false; // guest → caller opens the auth gate
    if (inFlight.current) return true;

    if (!isSupabase()) {
      localToggleLike(nestSlug, ownerId);
      return true;
    }

    inFlight.current = true;
    const previous = state;
    const next = {
      ...state,
      liked: !state.liked,
      likeCount: Math.max(0, state.likeCount + (state.liked ? -1 : 1)),
    };
    setState(next); // optimistic
    setError(null);
    try {
      if (next.liked) await social.like(nestSlug, ownerId, nestOwnerId, nestTitle);
      else await social.unlike(nestSlug, ownerId);
    } catch (e) {
      setState(previous); // roll back — never show a like that didn't persist
      setError(e instanceof Error ? e.message : "Your like could not be saved.");
    } finally {
      inFlight.current = false;
    }
    return true;
  }, [ownerId, nestSlug, nestOwnerId, nestTitle, state]);

  return { ...state, loading, error, toggleLike, refresh };
}
