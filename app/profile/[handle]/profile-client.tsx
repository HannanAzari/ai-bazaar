"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DoorOpen, Home } from "lucide-react";
import { Avatar } from "@/components/nest/app-shell/profile-summary";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { getNestProfile, onNestProfilesChanged, resolveByUsername, type NestProfile } from "@/lib/nest-profile-store";
import { onDocsChanged } from "@/lib/nest-document-store";
import { resolveTemplate } from "@/lib/nest-production-library";
import { FollowButton } from "@/components/nest/social/follow-button";
import { DoorTransition } from "@/components/nest/village/enter-transition";
import { deriveHouse } from "@/lib/nest-house";
import { followerCount, onSocialChanged, viewsForOwner } from "@/lib/nest-social";
import { profileLinks } from "@/lib/profile-links";
import { creatorReel, reelEntryPoint, type ReelEntry } from "@/lib/nest-reel";
import { IdentityBox } from "@/components/nest/profile/identity-box";
import { HouseScene } from "@/components/nest/profile/house-scene";
import { TopControls } from "@/components/nest/profile/top-controls";

// Day 3.3 — the public creator profile: top controls → compact identity box → grounded
// House → one bottom action. Composed, not accumulated: it aims to fit one viewport, has no
// Nest grid/rail, and never repeats identity. "Enter Nests" opens the immersive Nest reel.

export function ProfileClient({ handle }: { handle: string }) {
  const router = useRouter();
  const { ownerId } = useNestIdentity();
  const [profile, setProfile] = useState<NestProfile | null | undefined>(undefined); // undefined = resolving
  const [reel, setReel] = useState<ReelEntry[]>([]);
  const [followers, setFollowers] = useState(0);
  const [views, setViews] = useState(0);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    const resolve = () => setProfile(resolveByUsername(handle) ?? null);
    resolve();
    return onNestProfilesChanged(resolve);
  }, [handle]);

  useEffect(() => {
    if (!profile) return;
    const load = () => setReel(creatorReel(profile.userId));
    load();
    return onDocsChanged(load);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const refresh = () => { setFollowers(followerCount(profile.userId)); setViews(viewsForOwner(profile.userId)); };
    refresh();
    return onSocialChanged(refresh);
  }, [profile]);

  const live = profile ? getNestProfile(profile.userId) ?? profile : null;

  const house = useMemo(() => {
    if (!live) return null;
    const first = reelEntryPoint(reel);
    const tpl = first?.entry.doc.sourceTemplateId ? resolveTemplate(first.entry.doc.sourceTemplateId) : undefined;
    return deriveHouse({
      creator: { id: live.userId, username: live.username, displayName: live.displayName },
      persona: tpl?.persona,
      bio: live.bio,
      nestHref: first?.url,
    });
  }, [live, reel]);

  if (profile === undefined) {
    return <div className="mt-10 h-24 animate-pulse rounded-2xl border border-timber/15 bg-white/60" />;
  }

  if (profile === null || !live || !house) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-timber/25 bg-white/60 p-10 text-center">
        <Avatar />
        <p className="display text-2xl">No house here yet</p>
        <p className="max-w-xs text-sm text-ink/50">We couldn&rsquo;t find <span className="font-bold">@{handle}</span>. The handle may be free to claim.</p>
        <div className="mt-2 flex gap-2">
          <Link href="/create" className="rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">Build your house</Link>
          <Link href="/village" className="rounded-xl border border-timber/20 bg-white px-5 py-3 text-sm font-bold text-ink/70">Visit the village</Link>
        </div>
      </div>
    );
  }

  const isOwn = ownerId === profile.userId;
  const first = reelEntryPoint(reel);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 pb-2">
      <TopControls onBack={() => router.push("/village")} />

      <IdentityBox
        username={live.username}
        displayName={live.displayName}
        bio={live.bio}
        avatarUrl={live.avatarUrl}
        followers={followers}
        nests={reel.length}
        views={views}
        links={profileLinks(live)}
        action={
          isOwn ? (
            <Link href="/profile" className="inline-flex min-h-[36px] items-center rounded-full border border-timber/20 px-3 text-xs font-bold text-ink/70">Manage</Link>
          ) : (
            <FollowButton creatorId={profile.userId} />
          )
        }
      />

      {/* the House — grounded and the main visual object, but height-bounded so the sky
          above it stays shallow and the identity box is never pushed off-screen. */}
      <HouseScene house={house} className="min-h-[200px] flex-1" />

      {/* the single bottom action — pinned to the bottom of the viewport column */}
      {first ? (
        <button
          onClick={() => setEntering(true)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-5 text-base font-black text-parchment shadow-lift transition active:scale-95"
        >
          <DoorOpen className="size-5" /> Enter Nests
        </button>
      ) : (
        <div className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-dashed border-timber/30 bg-white/60 px-5 text-center text-sm text-ink/50">
          <Home className="size-4" /> This creator hasn&rsquo;t opened a Nest yet.
        </div>
      )}

      {entering && first ? (
        <DoorTransition style={house.style} mode="enter" onDone={() => router.push(first.url)} label={`Stepping into ${house.name}'s Nest…`} />
      ) : null}
    </div>
  );
}

