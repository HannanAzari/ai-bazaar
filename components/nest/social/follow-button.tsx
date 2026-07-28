"use client";

import { useEffect, useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { isFollowing as localIsFollowing, onSocialChanged, toggleFollow as localToggleFollow } from "@/lib/nest-social";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { AuthGateSheet } from "@/components/nest/social/auth-gate-sheet";
import { nestBackend } from "@/lib/nest-repo";
import * as social from "@/lib/nest/supabase-social-repo";

// M18 → M23B — a real follow against the shared `creator_follows` table, so Account A
// genuinely gains a follower when Account B taps this — on any device.
//
// Optimistic, and rolled back if the write fails: a "Following" state over a follow that
// does not exist is exactly the class of lie this sprint exists to remove.
export function FollowButton({ creatorId, tone = "ink", compact = false }: { creatorId?: string; tone?: "ink" | "light"; compact?: boolean }) {
  const { ownerId } = useNestIdentity();
  const [following, setFollowing] = useState(false);
  const [gate, setGate] = useState(false);
  const [morph, setMorph] = useState(false);

  useEffect(() => {
    if (!creatorId) return;
    if (nestBackend() !== "supabase") {
      const refresh = () => setFollowing(localIsFollowing(ownerId, creatorId));
      refresh();
      return onSocialChanged(refresh);
    }
    if (!ownerId) { setFollowing(false); return; }
    let alive = true;
    void social.isFollowing(ownerId, creatorId)
      .then((v) => { if (alive) setFollowing(v); })
      .catch(() => { if (alive) setFollowing(false); });
    return () => { alive = false; };
  }, [creatorId, ownerId]);

  // No creator to follow, or it's you → no button.
  if (!creatorId || creatorId === ownerId) return null;

  async function onTap() {
    if (!ownerId) { setGate(true); return; }
    setMorph(true);
    setTimeout(() => setMorph(false), 360);

    if (nestBackend() !== "supabase") {
      setFollowing(localToggleFollow(ownerId, creatorId!));
      return;
    }
    const next = !following;
    setFollowing(next); // optimistic
    try {
      await social.setFollowing(ownerId, creatorId!, next);
    } catch {
      setFollowing(!next); // never leave "Following" over a follow that didn't persist
    }
  }

  const light = tone === "light";
  const base = "inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition-[background-color,color,border-color,transform] duration-300 active:scale-95";
  const size = compact ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const style = following
    ? light ? "border border-white/40 text-white/90" : "border border-timber/25 bg-white text-ink/60"
    : light ? "bg-white text-terracotta" : "bg-terracotta text-parchment";
  return (
    <>
      <button onClick={() => void onTap()} aria-pressed={following} className={`${base} ${size} ${style} ${morph ? "follow-morph" : ""}`}>
        {following ? <><Check className="size-3.5" /> Following</> : <><UserPlus className="size-3.5" /> Follow</>}
        <style>{`@keyframes follow-morph { 0% { transform: scale(1) } 40% { transform: scale(1.07) } 100% { transform: scale(1) } } .follow-morph { animation: follow-morph .36s cubic-bezier(.34,1.26,.5,1) } @media (prefers-reduced-motion: reduce) { .follow-morph { animation: none } }`}</style>
      </button>
      <AuthGateSheet open={gate} onClose={() => setGate(false)} action="follow this creator" />
    </>
  );
}
