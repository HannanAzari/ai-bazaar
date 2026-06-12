"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, EyeOff, Heart, MapPin, Share2, Sparkles, UserPlus, Users } from "lucide-react";
import { ShopRoom } from "@/components/shop-room";
import { TagChips } from "@/components/tags-ui";
import { ReportButton } from "@/components/report-dialog";
import { GuestbookPanel } from "@/components/guestbook-panel";
import { SaveButton } from "@/components/save-button";
import { RoomExperience } from "@/components/room/room-experience";
import type { Shop } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";
import { useDemo } from "@/components/providers/demo-provider";
import { trackEvent } from "@/lib/events";
import { recordActivity } from "@/lib/activity";
import { useHiddenRefs } from "@/lib/use-hidden";
import { normalizeHandle } from "@/lib/creators";
import { flags } from "@/lib/flags";
import { bazaars } from "@/lib/data";

export function ShopPageClient({ shop }: { shop: Shop }) {
  const { ownedShop } = useDemo();
  const hidden = useHiddenRefs().has(shop.address) && ownedShop?.id !== shop.id;
  // Room Engine V1 is the default public surface; the legacy room is the fallback.
  if (flags.roomEngine && !hidden) return <RoomExperience shop={shop} />;
  return <LegacyHouseView shop={shop} hidden={hidden} />;
}

function LegacyHouseView({ shop, hidden }: { shop: Shop; hidden: boolean }) {
  const { user, likedShops, followedOwners, ownedShop, toggleLike, toggleFollow } = useDemo();
  const actor = { name: ownedShop?.owner ?? user?.name ?? "A visitor", handle: ownedShop?.ownerHandle ?? "guest" };
  const profileHref = `/u/${normalizeHandle(shop.ownerHandle)}`;
  const [copied, setCopied] = useState(false);
  const liked = likedShops.has(shop.id);
  const followed = followedOwners.has(shop.ownerHandle);
  const village = bazaars.find((item) => item.id === shop.bazaarId);

  // Entering a house records a house view and a room view (the room is the page).
  useEffect(() => {
    trackEvent("house_view", { shopId: shop.id });
    trackEvent("room_view", { shopId: shop.id });
  }, [shop.id]);

  const share = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    trackEvent("share_click", { shopId: shop.id });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const onLike = () => {
    if (!liked) {
      trackEvent("like", { shopId: shop.id });
      if (flags.activityFeed) recordActivity({ type: "liked_house", actorName: actor.name, actorHandle: actor.handle, summary: `liked ${shop.name}`, href: `/shop/${shop.address}` });
    }
    toggleLike(shop.id);
  };
  const onFollow = () => {
    if (!followed) {
      trackEvent("follow", { shopId: shop.id });
      if (flags.activityFeed) recordActivity({ type: "followed_creator", actorName: actor.name, actorHandle: actor.handle, summary: `followed ${shop.owner}`, href: profileHref });
    }
    toggleFollow(shop.ownerHandle);
  };

  return (
    <div className="shell py-4 sm:py-7">
      {/* The room is the page; everything else stays quiet around it */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink/40">
            <MapPin size={12} /> {village?.name ?? "The village"} · {shop.address}
          </p>
          <h1 className="display mt-1 text-3xl sm:text-4xl">{shop.name}</h1>
          <p className="mt-1 max-w-xl text-sm text-ink/50">{shop.tagline}</p>
          {shop.tags?.length ? <TagChips tags={shop.tags} className="mt-2.5" /> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onLike}
            className={cn("grid size-11 place-items-center rounded-full border shadow-sm transition hover:scale-105", liked ? "border-terracotta bg-terracotta text-white" : "border-ink/10 bg-white text-ink")}
            aria-label={liked ? "Unlike this place" : "Like this place"}
          >
            <Heart size={17} fill={liked ? "currentColor" : "none"} />
          </button>
          <button
            onClick={onFollow}
            className={cn("grid size-11 place-items-center rounded-full border shadow-sm transition hover:scale-105", followed ? "border-teal bg-teal text-white" : "border-ink/10 bg-white text-ink")}
            aria-label={followed ? `Unfollow ${shop.owner}` : `Follow ${shop.owner}`}
          >
            <UserPlus size={17} />
          </button>
          {flags.collections && <SaveButton variant="pill" target={{ kind: "house", shopAddress: shop.address, label: shop.name }} />}
          <button
            onClick={share}
            className="grid size-11 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-sm transition hover:scale-105"
            aria-label="Share this place"
          >
            {copied ? <Check size={17} className="text-teal" /> : <Share2 size={17} />}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_264px]">
        {hidden ? (
          <div className="grain shop-glow grid min-h-[420px] place-items-center rounded-[2.75rem] border-[10px] border-white/65 bg-[#ead7bd] p-8 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-ink/10 text-ink/50"><EyeOff size={26} /></span>
              <h2 className="display mt-4 text-2xl">This place is resting.</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink/55">A moderator has hidden this house while it&apos;s reviewed. Its owner and history are untouched.</p>
            </div>
          </div>
        ) : (
          <ShopRoom decorations={shop.decorations} onItemClick={(id) => trackEvent("decoration_click", { shopId: shop.id, targetId: id })} />
        )}

        <aside className="space-y-4 xl:sticky xl:top-20">
          <div className="card rounded-[1.75rem] p-5">
            {flags.creatorProfiles ? (
              <Link href={profileHref} className="group flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-rosewater text-sm font-black transition group-hover:bg-terracotta group-hover:text-white">{shop.avatar}</span>
                <div className="min-w-0">
                  <p className="eyebrow text-terracotta">Lives here</p>
                  <h2 className="truncate font-black group-hover:text-terracotta">{shop.owner}</h2>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-rosewater text-sm font-black">{shop.avatar}</span>
                <div className="min-w-0">
                  <p className="eyebrow text-terracotta">Lives here</p>
                  <h2 className="truncate font-black">{shop.owner}</h2>
                </div>
              </div>
            )}
            <p className="mt-3 text-sm leading-relaxed text-ink/60">{shop.bio}</p>
            {flags.creatorProfiles ? (
              <Link href={profileHref} className="mt-3 inline-block text-xs font-bold text-ink/40 hover:text-terracotta">{shop.ownerHandle}</Link>
            ) : (
              <p className="mt-3 text-xs font-bold text-ink/40">{shop.ownerHandle}</p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ink/10 pt-4 text-center">
              <div><strong className="block text-sm">{formatCount(shop.likes + (liked ? 1 : 0))}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Likes</span></div>
              <div><strong className="block text-sm">{formatCount(shop.followers + (followed ? 1 : 0))}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Followers</span></div>
              <div><strong className="flex items-center justify-center gap-1 text-sm"><Users size={13} /> {formatCount(shop.visitors)}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Visitors</span></div>
            </div>
          </div>

          {shop.links.length > 0 && (
            <div className="card space-y-2 rounded-[1.75rem] p-3">
              <p className="eyebrow px-2 pt-2 text-teal">From this house</p>
              {shop.links.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" onClick={() => trackEvent("link_click", { shopId: shop.id, targetId: link.id })} className="group flex min-h-12 items-center justify-between rounded-xl border border-ink/5 bg-white px-3 py-2 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:border-saffron hover:bg-saffron/10">
                  <span className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-parchment"><Sparkles size={14} className="text-terracotta" /></span>{link.label}</span>
                  <ExternalLink size={15} className="text-ink/30 transition group-hover:text-terracotta" />
                </a>
              ))}
            </div>
          )}

          {flags.guestbooks && <GuestbookPanel shop={shop} />}

          <ReportButton shop={shop} />
          <Link href="/discover" className="block rounded-full bg-teal/10 py-3 text-center text-sm font-bold text-teal transition hover:bg-teal hover:text-white">Keep wandering</Link>
        </aside>
      </div>
    </div>
  );
}
