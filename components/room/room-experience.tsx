"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, ExternalLink, Heart, MapPin, Share2, UserPlus, Users, X } from "lucide-react";
import { RoomCanvas } from "@/components/room/room-canvas";
import { ObjectActionModal } from "@/components/room/object-action-modal";
import { GuestbookPanel } from "@/components/guestbook-panel";
import { ReportButton } from "@/components/report-dialog";
import { SaveButton } from "@/components/save-button";
import { TagChips } from "@/components/tags-ui";
import { useDemo } from "@/components/providers/demo-provider";
import { getRoom } from "@/lib/room";
import { trackEvent } from "@/lib/events";
import { recordActivity } from "@/lib/activity";
import { normalizeHandle } from "@/lib/creators";
import { flags } from "@/lib/flags";
import { bazaars } from "@/lib/data";
import type { EventType, Room, RoomObject, Shop } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

type Drawer = "none" | "owner" | "guestbook";

/** Full-screen "you entered their room" surface. */
export function RoomExperience({ shop }: { shop: Shop }) {
  const { user, likedShops, followedOwners, ownedShop, toggleLike, toggleFollow } = useDemo();
  const actor = { name: ownedShop?.owner ?? user?.name ?? "A visitor", handle: ownedShop?.ownerHandle ?? "guest" };
  const profileHref = `/u/${normalizeHandle(shop.ownerHandle)}`;
  const village = bazaars.find((item) => item.id === shop.bazaarId);
  const liked = likedShops.has(shop.id);
  const followed = followedOwners.has(shop.ownerHandle);

  const [room, setRoom] = useState<Room | null>(null);
  const [drawer, setDrawer] = useState<Drawer>("none");
  const [actionObject, setActionObject] = useState<RoomObject | null>(null);
  const [copied, setCopied] = useState(false);

  // Load the room (saved layout or derived default) on the client, and refresh
  // if the owner saves a new layout in another tab.
  useEffect(() => {
    const sync = () => setRoom(getRoom(shop));
    sync();
    window.addEventListener("ai-bazaar-rooms-changed", sync);
    return () => window.removeEventListener("ai-bazaar-rooms-changed", sync);
  }, [shop]);

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

  const onActivate = (object: RoomObject) => {
    trackEvent("object_click", { shopId: shop.id, targetId: object.id });
    trackEvent("decoration_click", { shopId: shop.id, targetId: object.id });
    // V3: a specific "opened" event per interactive object type.
    const opened: Partial<Record<RoomObject["actionType"], EventType>> = {
      gallery: "gallery_opened",
      video: "video_opened",
      product: "product_opened",
      booking: "booking_opened",
      contact: "contact_opened",
      profile: "profile_opened",
      link: "link_click",
    };
    const event = opened[object.actionType];
    if (event) trackEvent(event, { shopId: shop.id, targetId: object.id });

    switch (object.actionType) {
      case "guestbook":
        if (flags.guestbooks) setDrawer("guestbook");
        return;
      case "none":
        return;
      default:
        // Gallery / video / link / product / booking / contact / profile all open
        // their real in-room panel (the visitor stays in the room).
        setActionObject(object);
    }
  };

  const objectCount = useMemo(() => room?.objects.filter((o) => !o.hidden).length ?? 0, [room]);

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-[#ead7bd]">
      {room && <RoomCanvas room={room} mode="public" ownerName={shop.owner} onActivate={onActivate} />}

      {/* Top-left: where am I */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2 sm:left-5 sm:top-5">
        <Link href={village ? `/bazaar/${village.slug}` : "/"} className="pointer-events-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-white/60 bg-[#fff8e9]/85 px-3 py-1.5 text-xs font-bold text-ink/60 shadow-soft backdrop-blur hover:text-terracotta">
          <ArrowLeft size={14} /> {village?.name ?? "Village"}
        </Link>
        <div className="pointer-events-auto max-w-[78vw] rounded-2xl border border-white/60 bg-[#fff8e9]/85 px-3.5 py-2 shadow-soft backdrop-blur sm:max-w-xs">
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-ink/40"><MapPin size={11} /> {shop.address}</p>
          <h1 className="display text-xl leading-tight sm:text-2xl">{shop.name}</h1>
          {shop.tags?.length ? <TagChips tags={shop.tags.slice(0, 3)} className="mt-1.5" /> : null}
        </div>
      </div>

      {/* Top-right: secondary actions */}
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2 sm:right-5 sm:top-5">
        <div className="flex gap-1.5 rounded-full border border-white/60 bg-[#fff8e9]/85 p-1.5 shadow-soft backdrop-blur">
          <button onClick={onLike} aria-label={liked ? "Unlike" : "Like"} className={cn("grid size-9 place-items-center rounded-full transition", liked ? "bg-terracotta text-white" : "text-ink hover:bg-white")}>
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
          </button>
          <button onClick={onFollow} aria-label={followed ? `Unfollow ${shop.owner}` : `Follow ${shop.owner}`} className={cn("grid size-9 place-items-center rounded-full transition", followed ? "bg-teal text-white" : "text-ink hover:bg-white")}>
            <UserPlus size={16} />
          </button>
          {flags.collections && <SaveButton target={{ kind: "house", shopAddress: shop.address, label: shop.name }} quick />}
          <button onClick={share} aria-label="Share" className="grid size-9 place-items-center rounded-full text-ink transition hover:bg-white">
            {copied ? <Check size={16} className="text-teal" /> : <Share2 size={16} />}
          </button>
        </div>
        <p className="rounded-full bg-[#fff8e9]/70 px-2.5 py-1 text-[10px] font-bold text-ink/40 shadow-sm backdrop-blur">{objectCount} things in this room</p>
      </div>

      {/* Bottom-left: owner + guestbook entry points */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 sm:bottom-5 sm:left-5">
        <button onClick={() => setDrawer("owner")} className="flex items-center gap-2.5 rounded-full border border-white/60 bg-[#fff8e9]/90 py-1.5 pl-1.5 pr-4 shadow-soft backdrop-blur transition hover:-translate-y-0.5">
          <span className="grid size-9 place-items-center rounded-full bg-rosewater text-xs font-black">{shop.avatar}</span>
          <span className="text-left">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-terracotta">Lives here</span>
            <span className="block text-sm font-black leading-tight">{shop.owner}</span>
          </span>
        </button>
        {flags.guestbooks && (
          <button onClick={() => setDrawer("guestbook")} className="grid size-11 place-items-center rounded-full border border-white/60 bg-[#fff8e9]/90 text-ink shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:text-terracotta" aria-label="Open guestbook">
            <BookOpen size={18} />
          </button>
        )}
      </div>

      {/* ── Drawers ── */}
      {drawer !== "none" && (
        <div className="absolute inset-0 z-30 bg-ink/30 backdrop-blur-sm" onClick={() => setDrawer("none")}>
          <aside
            className="absolute right-0 top-0 flex h-full w-[min(92vw,380px)] flex-col overflow-y-auto bg-[#fff8e9] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button onClick={() => setDrawer("none")} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white" aria-label="Close panel"><X size={17} /></button>

            {drawer === "owner" && (
              <div className="mt-8 space-y-4">
                <Link href={flags.creatorProfiles ? profileHref : "#"} className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-rosewater text-sm font-black">{shop.avatar}</span>
                  <div>
                    <p className="eyebrow text-terracotta">Lives here</p>
                    <h2 className="display text-2xl">{shop.owner}</h2>
                    <p className="text-xs font-bold text-ink/40">{shop.ownerHandle}</p>
                  </div>
                </Link>
                <p className="text-sm leading-relaxed text-ink/60">{shop.bio}</p>
                <div className="grid grid-cols-3 gap-2 rounded-2xl border border-ink/10 bg-white/60 p-3 text-center">
                  <div><strong className="block text-sm">{formatCount(shop.likes + (liked ? 1 : 0))}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Likes</span></div>
                  <div><strong className="block text-sm">{formatCount(shop.followers + (followed ? 1 : 0))}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Followers</span></div>
                  <div><strong className="flex items-center justify-center gap-1 text-sm"><Users size={13} /> {formatCount(shop.visitors)}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Visitors</span></div>
                </div>
                {shop.links.length > 0 && (
                  <div className="space-y-2">
                    <p className="eyebrow text-teal">From this house</p>
                    {shop.links.map((link) => (
                      <a key={link.id} href={link.url} target="_blank" rel="noreferrer" onClick={() => trackEvent("link_click", { shopId: shop.id, targetId: link.id })} className="flex min-h-11 items-center justify-between rounded-xl border border-ink/5 bg-white px-3 text-sm font-bold shadow-sm transition hover:border-saffron hover:bg-saffron/10">
                        {link.label}<ExternalLink size={15} className="text-ink/30" />
                      </a>
                    ))}
                  </div>
                )}
                <ReportButton shop={shop} />
                <Link href="/discover" className="block rounded-full bg-teal/10 py-3 text-center text-sm font-bold text-teal transition hover:bg-teal hover:text-white">Keep wandering</Link>
              </div>
            )}

            {drawer === "guestbook" && flags.guestbooks && (
              <div className="mt-8">
                <GuestbookPanel shop={shop} />
              </div>
            )}
          </aside>
        </div>
      )}

      {actionObject && <ObjectActionModal object={actionObject} shop={shop} onClose={() => setActionObject(null)} />}
    </div>
  );
}
