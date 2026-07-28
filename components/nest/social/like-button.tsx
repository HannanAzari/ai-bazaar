"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { formatCount } from "@/lib/nest-engagement";
import { useNestSocial } from "@/components/nest/social/use-nest-social";
import { AuthGateSheet } from "@/components/nest/social/auth-gate-sheet";

// M18 → M23B — a real like against the shared `nest_likes` table.
//
// One like per user per Nest is enforced by the table's primary key, not by client
// bookkeeping, so a double-tap or a second device cannot produce two likes. The state
// updates optimistically and rolls back if the write fails (see useNestSocial).
//
// A guest gets the reusable centred auth modal; after signing in they stay exactly where
// they were — same Nest, same scroll position — and can tap again.
export function LikeButton({
  nestId,
  tone = "ink",
  ownerId,
  nestTitle,
}: {
  nestId: string;
  tone?: "ink" | "light";
  /** The Nest's owner, so a like can notify them. */
  ownerId?: string;
  nestTitle?: string;
}) {
  const { liked, likeCount, toggleLike, error } = useNestSocial(nestId, ownerId, nestTitle);
  const [pop, setPop] = useState(false);
  const [gate, setGate] = useState(false);

  async function onTap() {
    const wasLiked = liked;
    const handled = await toggleLike();
    if (!handled) { setGate(true); return; }
    if (!wasLiked) { setPop(true); setTimeout(() => setPop(false), 440); }
  }

  const light = tone === "light";
  return (
    <>
      <button
        onClick={onTap}
        aria-pressed={liked}
        aria-label={liked ? "Unlike" : "Like"}
        title={error ?? undefined}
        className={`flex items-center gap-1.5 text-sm font-bold transition active:scale-95 ${light ? "text-white" : "text-ink/70"}`}
      >
        <span className={pop ? "like-pop" : ""}>
          <Heart className={`size-5 transition ${liked ? "fill-terracotta text-terracotta" : ""}`} />
        </span>
        {formatCount(likeCount)}
        <style>{`@keyframes like-pop { 0% { transform: scale(1) } 30% { transform: scale(1.28) } 58% { transform: scale(0.95) } 100% { transform: scale(1) } } .like-pop { display: inline-flex; animation: like-pop .44s cubic-bezier(.34,1.26,.5,1) } @media (prefers-reduced-motion: reduce) { .like-pop { animation: none } }`}</style>
      </button>
      <AuthGateSheet open={gate} onClose={() => setGate(false)} action="like this Nest" />
    </>
  );
}
