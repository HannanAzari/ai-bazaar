"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { isLiked, likeCount, onSocialChanged, toggleLike } from "@/lib/nest-social";
import { formatCount } from "@/lib/nest-engagement";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { AuthGateSheet } from "@/components/nest/social/auth-gate-sheet";

// M18 — a real like: toggles persisted state, updates the count instantly, animates a
// pop, and one-per-user. Guests are prompted to sign in (then it stays put — they can
// tap again). Works on the feed + visitor page.
export function LikeButton({ nestId, tone = "ink" }: { nestId: string; tone?: "ink" | "light" }) {
  const { ownerId } = useNestIdentity();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [pop, setPop] = useState(false);
  const [gate, setGate] = useState(false);

  useEffect(() => {
    const refresh = () => { setLiked(isLiked(nestId, ownerId)); setCount(likeCount(nestId)); };
    refresh();
    return onSocialChanged(refresh);
  }, [nestId, ownerId]);

  function onTap() {
    if (!ownerId) { setGate(true); return; }
    const nowLiked = toggleLike(nestId, ownerId);
    if (nowLiked) { setPop(true); setTimeout(() => setPop(false), 440); }
  }

  const light = tone === "light";
  return (
    <>
      <button onClick={onTap} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} className={`flex items-center gap-1.5 text-sm font-bold transition active:scale-95 ${light ? "text-white" : "text-ink/70"}`}>
        <span className={pop ? "like-pop" : ""}>
          <Heart className={`size-5 transition ${liked ? "fill-terracotta text-terracotta" : ""}`} />
        </span>
        {formatCount(count)}
        <style>{`@keyframes like-pop { 0% { transform: scale(1) } 30% { transform: scale(1.28) } 58% { transform: scale(0.95) } 100% { transform: scale(1) } } .like-pop { display: inline-flex; animation: like-pop .44s cubic-bezier(.34,1.26,.5,1) } @media (prefers-reduced-motion: reduce) { .like-pop { animation: none } }`}</style>
      </button>
      <AuthGateSheet open={gate} onClose={() => setGate(false)} action="like this Nest" />
    </>
  );
}
