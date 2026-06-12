"use client";

import Link from "next/link";
import { ArrowUpRight, Heart, MapPin, Users } from "lucide-react";
import { useDemo } from "@/components/providers/demo-provider";
import { House } from "@/components/scene/house";
import { SaveButton } from "@/components/save-button";
import { bazaars } from "@/lib/data";
import { trackEvent } from "@/lib/events";
import { normalizeHandle } from "@/lib/creators";
import { flags } from "@/lib/flags";
import type { Shop } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

export function ShopCard({ shop, compact = false }: { shop: Shop; compact?: boolean }) {
  const { likedShops, toggleLike } = useDemo();
  const liked = likedShops.has(shop.id);
  const accent = bazaars.find((village) => village.id === shop.bazaarId)?.accent;
  const onLike = () => {
    if (!liked) trackEvent("like", { shopId: shop.id });
    toggleLike(shop.id);
  };

  return (
    <article className="card group overflow-hidden rounded-4xl transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Link href={`/shop/${shop.address}`} className="block">
        <div className={cn("grain relative overflow-hidden bg-gradient-to-br p-5", shop.palette, compact ? "h-48" : "h-60")}>
          <div className="absolute -right-10 -top-16 size-52 rounded-full bg-white/35 blur-3xl" />
          {/* The owner's plot: grass, then their actual house from the kit */}
          <div className="absolute inset-x-5 bottom-0 h-12 rounded-t-[50%] bg-gradient-to-b from-[#8fbd66]/90 to-[#6b9a48]/90" />
          <div className={cn("absolute bottom-1 left-1/2 -translate-x-1/2 transition duration-500 group-hover:-translate-y-1 group-hover:scale-[1.04]", compact ? "w-[38%]" : "w-[44%]")}>
            <House seed={`${shop.bazaarId}:${shop.slotNumber}`} accent={accent} lod="card" state="lived" />
          </div>
          <div className="absolute bottom-5 left-5 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white shadow-lg transition sm:translate-y-3 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
            Step inside <ArrowUpRight className="ml-1 inline" size={13} />
          </div>
          <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-white/80 py-1.5 pl-1.5 pr-3 shadow-sm backdrop-blur">
            <span className="grid size-8 place-items-center rounded-full bg-ink text-[10px] font-black text-white">{shop.avatar}</span>
            <span className="text-[11px] font-black">{shop.owner.split(" ")[0]}</span>
          </div>
        </div>
      </Link>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            {flags.creatorProfiles ? (
              <Link href={`/u/${normalizeHandle(shop.ownerHandle)}`} className="mb-1 inline-block text-[10px] font-black uppercase tracking-[.16em] text-terracotta hover:underline">{shop.ownerHandle}</Link>
            ) : (
              <p className="mb-1 text-[10px] font-black uppercase tracking-[.16em] text-terracotta">{shop.ownerHandle}</p>
            )}
            <Link href={`/shop/${shop.address}`} className="block text-xl font-black hover:text-terracotta">{shop.name}</Link>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink/55">{shop.tagline}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {flags.collections && <SaveButton target={{ kind: "house", shopAddress: shop.address, label: shop.name }} quick />}
            <button
              onClick={onLike}
              className={cn("grid size-10 shrink-0 place-items-center rounded-full border transition", liked ? "border-terracotta bg-terracotta text-white" : "border-ink/10 bg-white hover:border-terracotta")}
              aria-label={liked ? "Unlike place" : "Like place"}
            >
              <Heart size={17} fill={liked ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/10 pt-4 text-xs font-bold text-ink/45">
          <span className="flex min-w-0 items-center gap-1 truncate"><MapPin size={13} className="shrink-0" /> {shop.address}</span>
          <span className="flex shrink-0 items-center gap-1"><Users size={13} /> {formatCount(shop.visitors)}</span>
        </div>
      </div>
    </article>
  );
}
