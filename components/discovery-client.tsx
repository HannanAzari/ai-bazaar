"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Flame, Hash, LayoutGrid, Rows3, Users, X } from "lucide-react";
import { useAllShops } from "@/components/providers/demo-provider";
import { ShopCard } from "@/components/shop-card";
import { TagChips } from "@/components/tags-ui";
import { tagCounts } from "@/lib/tags";
import { useHiddenRefs } from "@/lib/use-hidden";
import { bazaars } from "@/lib/data";
import { cn, formatCount } from "@/lib/utils";
import type { Shop } from "@/lib/types";

type Mode = "trending" | "newest";

function ShopRow({ shop }: { shop: Shop }) {
  const village = bazaars.find((item) => item.id === shop.bazaarId);
  return (
    <Link href={`/shop/${shop.address}`} className="card group flex items-center gap-4 rounded-2xl p-3 transition hover:-translate-y-0.5 hover:shadow-lift">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-sm font-black text-white">{shop.avatar}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black group-hover:text-terracotta">{shop.name}</p>
        <p className="truncate text-xs text-ink/50">{shop.address} · {village?.name}</p>
      </div>
      <span className="hidden items-center gap-1 text-xs font-bold text-ink/45 sm:flex"><Users size={13} /> {formatCount(shop.visitors)}</span>
    </Link>
  );
}

export function DiscoveryClient() {
  const allShops = useAllShops();
  const hidden = useHiddenRefs();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("trending");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[name="address"]');
    const handler = () => setQuery(input?.value ?? "");
    input?.addEventListener("input", handler);
    return () => input?.removeEventListener("input", handler);
  }, []);

  const popular = useMemo(() => tagCounts(allShops).slice(0, 14), [allShops]);

  const feed = useMemo(() => {
    let list = allShops.filter((shop) => !shop.hidden && !hidden.has(shop.address));
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((shop) => `${shop.address} ${shop.name} ${shop.owner} ${(shop.tags ?? []).join(" ")}`.toLowerCase().includes(q));
    }
    if (activeTag) list = list.filter((shop) => (shop.tags ?? []).includes(activeTag));
    return [...list].sort((a, b) =>
      mode === "trending" ? b.likes - a.likes : b.createdAt.localeCompare(a.createdAt),
    );
  }, [allShops, query, activeTag, mode, hidden]);

  return (
    <div className="mt-12">
      {/* Mode + view controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-timber/15 bg-parchment/70 p-1 shadow-soft">
          <button onClick={() => setMode("trending")} className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition", mode === "trending" ? "bg-terracotta text-white" : "text-ink-soft")}>
            <Flame size={16} /> Trending
          </button>
          <button onClick={() => setMode("newest")} className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition", mode === "newest" ? "bg-teal text-white" : "text-ink-soft")}>
            <Clock3 size={16} /> Newest
          </button>
        </div>
        <div className="hidden rounded-full border border-timber/15 bg-parchment/70 p-1 shadow-soft sm:flex">
          <button onClick={() => setView("grid")} className={cn("grid size-9 place-items-center rounded-full transition", view === "grid" ? "bg-ink text-white" : "text-ink-soft")} aria-label="Grid view"><LayoutGrid size={16} /></button>
          <button onClick={() => setView("list")} className={cn("grid size-9 place-items-center rounded-full transition", view === "list" ? "bg-ink text-white" : "text-ink-soft")} aria-label="List view"><Rows3 size={16} /></button>
        </div>
      </div>

      {/* Explore by tag */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-ink/40"><Hash size={13} /> Explore by tag</span>
        {popular.slice(0, 10).map((entry) => (
          <button
            key={entry.tag}
            onClick={() => setActiveTag((current) => (current === entry.tag ? null : entry.tag))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-bold transition",
              activeTag === entry.tag ? "border-terracotta bg-terracotta text-white" : "border-timber/20 bg-parchment/70 text-ink-soft hover:border-terracotta hover:text-terracotta",
            )}
          >
            {entry.tag}
          </button>
        ))}
        {activeTag && (
          <button onClick={() => setActiveTag(null)} className="inline-flex items-center gap-1 text-xs font-bold text-terracotta">
            <X size={13} /> clear
          </button>
        )}
      </div>

      {/* ── Mobile: swipe discovery deck ── */}
      <div className="mt-7 sm:hidden">
        {feed.length ? (
          <div className="hide-scrollbar snap-rail -mx-4 flex gap-4 overflow-x-auto px-4 pb-4">
            {feed.map((shop) => (
              <div key={shop.id} className="w-[84vw] shrink-0 snap-center">
                <ShopCard shop={shop} />
              </div>
            ))}
          </div>
        ) : (
          <p className="card rounded-3xl p-8 text-center text-ink/55">Nothing matches yet. Try another tag.</p>
        )}
        <p className="mt-1 text-center text-xs text-ink/40">Swipe to keep discovering →</p>
      </div>

      {/* ── Desktop: grid / list ── */}
      <div className="mt-7 hidden sm:block">
        {feed.length === 0 ? (
          <div className="card rounded-3xl p-10 text-center text-ink/55">No houses match that {activeTag ? "tag" : "search"} yet.</div>
        ) : view === "grid" ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {feed.map((shop) => <ShopCard key={shop.id} shop={shop} compact />)}
          </div>
        ) : (
          <div className="grid gap-3">
            {feed.map((shop) => <ShopRow key={shop.id} shop={shop} />)}
          </div>
        )}
      </div>

      {/* Popular tags */}
      {!query && (
        <section className="mt-14">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-terracotta/10 text-terracotta"><Hash size={19} /></span>
              <div><p className="text-xs font-black uppercase tracking-[.18em] text-terracotta">Threads across the village</p><h2 className="display text-3xl">Popular tags</h2></div>
            </div>
            <Link href="/tags" className="text-sm font-bold text-teal hover:underline">All tags →</Link>
          </div>
          <TagChips tags={popular.map((entry) => entry.tag)} size="md" />
        </section>
      )}
    </div>
  );
}
