"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Rows3, Search, Trees } from "lucide-react";
import { useDiscovery } from "@/components/nest/app-shell/use-discovery";
import { DiscoveryNestCard } from "@/components/nest/app-shell/discovery";
import { collectCategories, collectTags, filterByTag, searchDiscovery } from "@/lib/nest-discovery";

// M17 — Explore is search/discovery (distinct from Home's feed). Search by title,
// creator, or tags; filter by category (persona) chips + trending tag chips; grid/list
// toggle. Still no likes/comments/recommendations — just finding a Nest to wander into.
export function ExploreClient() {
  const { items } = useDiscovery();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>();
  const [category, setCategory] = useState<string>();
  const [layout, setLayout] = useState<"grid" | "row">("grid");

  const categories = useMemo(() => collectCategories(items), [items]);
  const trending = useMemo(() => collectTags(items, 8), [items]);

  const results = useMemo(() => {
    let out = searchDiscovery(items, query);
    if (category) out = out.filter((it) => it.category === category);
    if (tag) out = filterByTag(out, tag);
    return out;
  }, [items, query, category, tag]);

  const filtering = !!(query.trim() || tag || category);

  return (
    <div className="space-y-4 pt-1">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="display text-3xl">Explore</h1>
          <p className="mt-1 text-sm text-ink/55">Search cozy Nests, creators, and themes.</p>
        </div>
        <Link href="/village" className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-terracotta px-3.5 py-2 text-xs font-black text-parchment shadow-soft active:scale-95">
          <Trees className="size-4" /> Village
        </Link>
      </header>

      <div className="flex items-center gap-2 rounded-2xl border border-timber/20 bg-white px-3 shadow-soft">
        <Search className="size-4 text-ink/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Nests, creators & themes"
          aria-label="Search"
          style={{ fontSize: 16 }}
          className="w-full bg-transparent py-3 outline-none"
        />
      </div>

      {categories.length > 0 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(category === c ? undefined : c)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${category === c ? "border-terracotta bg-terracotta text-parchment" : "border-timber/20 bg-white text-ink/60 hover:text-ink"}`}>{c}</button>
          ))}
        </div>
      ) : null}

      {trending.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wider text-ink/45">Trending themes</p>
          <div className="flex flex-wrap gap-2">
            {trending.map((t) => (
              <button key={t} onClick={() => setTag(tag === t ? undefined : t)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${tag === t ? "border-terracotta bg-terracotta text-parchment" : "border-timber/20 bg-white text-ink/60 hover:text-ink"}`}>#{t}</button>
            ))}
          </div>
        </div>
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-black text-ink">{filtering ? "Results" : "Discover"}</h2>
            {filtering ? <span className="text-[11px] text-ink/45">{results.length} match{results.length === 1 ? "" : "es"}</span> : null}
          </div>
          <div className="flex rounded-full bg-white p-0.5 shadow-soft">
            <button onClick={() => setLayout("grid")} aria-label="Grid view" className={`grid size-8 place-items-center rounded-full ${layout === "grid" ? "bg-ink text-parchment" : "text-ink/45"}`}><LayoutGrid className="size-4" /></button>
            <button onClick={() => setLayout("row")} aria-label="List view" className={`grid size-8 place-items-center rounded-full ${layout === "row" ? "bg-ink text-parchment" : "text-ink/45"}`}><Rows3 className="size-4" /></button>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-timber/25 bg-white/60 p-8 text-center">
            <p className="text-sm text-ink/55">No Nests match your search yet.</p>
            <div className="flex gap-2">
              <Link href="/create" className="rounded-xl bg-terracotta px-4 py-2.5 text-sm font-bold text-parchment">Create a Nest</Link>
              {filtering ? <button onClick={() => { setQuery(""); setTag(undefined); setCategory(undefined); }} className="rounded-xl border border-timber/20 bg-white px-4 py-2.5 text-sm font-bold text-ink/70">Clear filters</button> : null}
            </div>
          </div>
        ) : layout === "grid" ? (
          <div className="grid grid-cols-2 gap-3">
            {results.map((it) => <DiscoveryNestCard key={it.key} item={it} />)}
          </div>
        ) : (
          <div className="space-y-2.5">
            {results.map((it) => <DiscoveryNestCard key={it.key} item={it} layout="row" />)}
          </div>
        )}
      </section>
    </div>
  );
}
