"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { AuthGateSheet } from "@/components/nest/social/auth-gate-sheet";
import { useCreatorSocial } from "@/components/nest/social/use-creator-social";

// M18 → M23B — a real follow against the shared `creator_follows` table, so Account A
// genuinely gains a follower when Account B taps this — on any device.
//
// Optimistic, and rolled back if the write fails: a "Following" state over a follow that
// does not exist is exactly the class of lie this sprint exists to remove.
export function FollowButton({ creatorId, tone = "ink", compact = false }: { creatorId?: string; tone?: "ink" | "light"; compact?: boolean }) {
  const { ownerId } = useNestIdentity();
  // M24 §8 — follow state comes from the SHARED store, so pressing Follow here also moves
  // the follower count on the Profile, in the creator drawer and on every visible card.
  const { following, setFollowing } = useCreatorSocial(creatorId);
  const [gate, setGate] = useState(false);
  const [morph, setMorph] = useState(false);

  // No creator to follow, or it's you → no button.
  if (!creatorId || creatorId === ownerId) return null;

  async function onTap() {
    if (!ownerId) { setGate(true); return; }
    setMorph(true);
    setTimeout(() => setMorph(false), 360);
    await setFollowing(!following, ownerId);
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
