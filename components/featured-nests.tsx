"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Flame, Sparkles } from "lucide-react";
import { useAllShops } from "@/components/providers/demo-provider";
import { ShopCard } from "@/components/shop-card";
import { getEvents } from "@/lib/events";
import { rankNewCreators, rankRecentlyActive, rankTrending } from "@/lib/discovery";
import { useHiddenRefs } from "@/lib/use-hidden";
import type { BazaarEvent, Shop } from "@/lib/types";

const LIMIT = 6;

function NestRail({ icon, eyebrow, title, blurb, shops }: { icon: React.ReactNode; eyebrow: string; title: string; blurb: string; shops: Shop[] }) {
  if (!shops.length) return null;
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-terracotta/10 text-terracotta">{icon}</span>
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-terracotta">{eyebrow}</p>
          <h2 className="display text-3xl">{title}</h2>
        </div>
      </div>
      <p className="mb-4 max-w-xl text-sm text-ink/50">{blurb}</p>
      {/* Mobile: swipe rail · Desktop: grid — reusing the existing house cards. */}
      <div className="hide-scrollbar snap-rail -mx-4 flex gap-4 overflow-x-auto px-4 pb-3 sm:hidden">
        {shops.map((shop) => (
          <div key={shop.id} className="w-[78vw] shrink-0 snap-center"><ShopCard shop={shop} compact /></div>
        ))}
      </div>
      <div className="hidden gap-5 sm:grid md:grid-cols-2 lg:grid-cols-3">
        {shops.map((shop) => <ShopCard key={shop.id} shop={shop} compact />)}
      </div>
    </section>
  );
}

/**
 * Featured Nests (Discovery V1, Tasks 6–7) — the first creator-discovery layer.
 * Three curated ways to surface existing creators, populated from real stored
 * data (recorded visits + last activity, falling back to seeded house data).
 * Reuses existing house visuals/room cards; no feed, no social graph.
 */
export function FeaturedNests() {
  const allShops = useAllShops();
  const hidden = useHiddenRefs();
  const [events, setEvents] = useState<BazaarEvent[]>([]);

  useEffect(() => {
    const sync = () => setEvents(getEvents());
    sync();
    window.addEventListener("ai-bazaar-events-changed", sync);
    return () => window.removeEventListener("ai-bazaar-events-changed", sync);
  }, []);

  const trending = useMemo(() => rankTrending(allShops, events, hidden).slice(0, LIMIT), [allShops, events, hidden]);
  const newest = useMemo(() => rankNewCreators(allShops, hidden).slice(0, LIMIT), [allShops, hidden]);
  const active = useMemo(() => rankRecentlyActive(allShops, events, hidden).slice(0, LIMIT), [allShops, events, hidden]);

  return (
    <div>
      <NestRail icon={<Flame size={19} />} eyebrow="Most visited" title="Trending nests" blurb="The rooms drawing the most visitors right now." shops={trending} />
      <NestRail icon={<Sparkles size={19} />} eyebrow="Just moved in" title="New creators" blurb="The newest neighbours to open their doors." shops={newest} />
      <NestRail icon={<Clock3 size={19} />} eyebrow="Recently active" title="Buzzing lately" blurb="Creators whose places saw activity most recently." shops={active} />
    </div>
  );
}
