"use client";

import { useEffect, useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { isFollowing, onSocialChanged, toggleFollow } from "@/lib/nest-social";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { AuthGateSheet } from "@/components/nest/social/auth-gate-sheet";

// M18 — a real follow: toggles persisted state instantly (no refresh), notifies the
// creator, and prompts guests to sign in. Hidden when you're looking at yourself.
export function FollowButton({ creatorId, tone = "ink", compact = false }: { creatorId?: string; tone?: "ink" | "light"; compact?: boolean }) {
  const { ownerId } = useNestIdentity();
  const [following, setFollowing] = useState(false);
  const [gate, setGate] = useState(false);

  useEffect(() => {
    if (!creatorId) return;
    const refresh = () => setFollowing(isFollowing(ownerId, creatorId));
    refresh();
    return onSocialChanged(refresh);
  }, [creatorId, ownerId]);

  // No creator to follow, or it's you → no button.
  if (!creatorId || creatorId === ownerId) return null;

  function onTap() {
    if (!ownerId) { setGate(true); return; }
    setFollowing(toggleFollow(ownerId, creatorId!));
  }

  const light = tone === "light";
  const base = "inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition active:scale-95";
  const size = compact ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const style = following
    ? light ? "border border-white/40 text-white/90" : "border border-timber/25 bg-white text-ink/60"
    : light ? "bg-white text-terracotta" : "bg-terracotta text-parchment";
  return (
    <>
      <button onClick={onTap} aria-pressed={following} className={`${base} ${size} ${style}`}>
        {following ? <><Check className="size-3.5" /> Following</> : <><UserPlus className="size-3.5" /> Follow</>}
      </button>
      <AuthGateSheet open={gate} onClose={() => setGate(false)} action="follow this creator" />
    </>
  );
}
