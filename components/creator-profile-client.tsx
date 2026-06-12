"use client";

import Link from "next/link";
import { Activity, ExternalLink, Home, UserPlus } from "lucide-react";
import { useAllShops, useDemo } from "@/components/providers/demo-provider";
import { ShopCard } from "@/components/shop-card";
import { ActivityFeed } from "@/components/activity-feed";
import { getCreator } from "@/lib/creators";
import { trackEvent } from "@/lib/events";
import { recordActivity } from "@/lib/activity";
import { flags } from "@/lib/flags";
import { cn, formatCount } from "@/lib/utils";

export function CreatorProfileClient({ handle }: { handle: string }) {
  const shops = useAllShops();
  const { user, ownedShop, followedOwners, toggleFollow } = useDemo();
  const creator = getCreator(shops, handle);

  if (!creator) {
    return (
      <div className="shell py-20 text-center">
        <h1 className="display text-4xl">No creator here yet.</h1>
        <p className="mt-3 text-ink/55">We couldn&apos;t find a maker with the handle @{handle}.</p>
        <Link href="/discover" className="mt-6 inline-block font-bold text-terracotta">Explore the village →</Link>
      </div>
    );
  }

  const followed = followedOwners.has(creator.displayHandle);
  const onFollow = () => {
    if (!followed) {
      trackEvent("follow");
      if (flags.activityFeed) {
        recordActivity({
          type: "followed_creator",
          actorName: ownedShop?.owner ?? user?.name ?? "A visitor",
          actorHandle: ownedShop?.ownerHandle ?? "guest",
          summary: `followed ${creator.name}`,
          href: `/u/${creator.handle}`,
        });
      }
    }
    toggleFollow(creator.displayHandle);
  };

  return (
    <div className="shell py-8 sm:py-12">
      {/* Identity band */}
      <section className="grain relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#5c3e26] to-terracotta px-6 py-9 text-white sm:px-10">
        <div className="absolute -right-16 -top-20 size-72 rounded-full bg-lantern/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <span className="grid size-20 shrink-0 place-items-center rounded-3xl bg-white/15 text-2xl font-black backdrop-blur sm:size-24">{creator.avatar}</span>
          <div className="min-w-0 flex-1">
            <h1 className="display text-4xl sm:text-5xl">{creator.name}</h1>
            <p className="mt-1 font-bold text-lantern">{creator.displayHandle}</p>
            <p className="mt-3 max-w-xl text-white/70">{creator.bio}</p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <button
              onClick={onFollow}
              className={cn("inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-soft transition", followed ? "bg-white/20 text-white hover:bg-white/25" : "bg-white text-[#5c3e26] hover:bg-lantern")}
            >
              <UserPlus size={16} /> {followed ? "Following" : "Follow"}
            </button>
            <div className="flex gap-6 text-center">
              <div><strong className="display block text-2xl">{formatCount(creator.followers + (followed ? 1 : 0))}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Followers</span></div>
              <div><strong className="display block text-2xl">{formatCount(creator.following)}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Following</span></div>
              <div><strong className="display block text-2xl">{creator.houses.length}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Houses</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Owned houses */}
        <section>
          <h2 className="display flex items-center gap-2 text-2xl"><Home size={20} className="text-terracotta" /> {creator.name.split(" ")[0]}&apos;s {creator.houses.length === 1 ? "house" : "houses"}</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {creator.houses.map((house) => <ShopCard key={house.id} shop={house} compact />)}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20">
          {creator.links.length > 0 && (
            <div className="card space-y-2 rounded-[1.75rem] p-3">
              <p className="eyebrow px-2 pt-2 text-teal">Find {creator.name.split(" ")[0]} elsewhere</p>
              {creator.links.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="group flex min-h-12 items-center justify-between rounded-xl border border-ink/5 bg-white px-3 py-2 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:border-saffron hover:bg-saffron/10">
                  {link.label}
                  <ExternalLink size={15} className="text-ink/30 transition group-hover:text-terracotta" />
                </a>
              ))}
            </div>
          )}

          {/* Recent activity — real feed when enabled, placeholder otherwise */}
          <div className="card rounded-[1.75rem] p-5">
            <p className="eyebrow text-terracotta">Recent activity</p>
            <div className="mt-3">
              {flags.activityFeed ? (
                <ActivityFeed handle={creator.handle} limit={5} emptyHint={`${creator.name.split(" ")[0]} hasn't been active here yet.`} />
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink/15 bg-white/40 p-6 text-center">
                  <Activity size={22} className="text-ink/30" />
                  <p className="text-sm text-ink/50">A timeline of visits, likes, and guestbook notes will appear here soon.</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
