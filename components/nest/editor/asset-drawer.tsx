"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, Sparkles, Star } from "lucide-react";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import {
  ASSET_CATEGORY_TREE,
  assetInCategory,
  classifyAsset,
  getFavourites,
  getRecent,
  isAnimatedAsset,
  searchAssets,
  toggleFavourite,
  type AssetCategoryNode,
} from "@/lib/nest-editor-asset-index";

// Telegram-inspired (NOT branded) asset keyboard: a bottom sheet that keeps the Nest
// visible above it. Search · Recent · Favourites · category tabs (child-category
// capable, driven by the asset-index tree). Image-first tiles; tap to add at the
// deterministic recommended position; star to favourite (local). Placeholder badges
// appear only in Advanced/internal mode.

const CAT_KEY = "nestudio:nest-editor:v1:drawer-category";

function readCat(): string {
  try {
    return (typeof window !== "undefined" && window.localStorage.getItem(CAT_KEY)) || "all";
  } catch {
    return "all";
  }
}
function writeCat(id: string) {
  try {
    window.localStorage.setItem(CAT_KEY, id);
  } catch {
    /* ignore */
  }
}

/** The top-level node that owns `categoryId` (itself or via a child). */
function topFor(categoryId: string): AssetCategoryNode | undefined {
  return ASSET_CATEGORY_TREE.find((n) => n.id === categoryId || n.children?.some((c) => c.id === categoryId));
}

export function AssetDrawer({
  assets,
  advanced,
  onAdd,
  onClose,
}: {
  assets: LivingNestAsset[];
  advanced: boolean;
  onAdd: (asset: LivingNestAsset) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setCategory(readCat());
    setFavourites(getFavourites());
    setRecent(getRecent());
  }, []);

  const activeTop = topFor(category);
  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const list = useMemo<LivingNestAsset[]>(() => {
    if (query.trim()) return searchAssets(assets, query);
    if (category === "recent") return recent.map((id) => byId[id]).filter(Boolean) as LivingNestAsset[];
    if (category === "favourites") return favourites.map((id) => byId[id]).filter(Boolean) as LivingNestAsset[];
    const ctx = { recentIds: recent, favouriteIds: favourites };
    return assets.filter((a) => assetInCategory(a, category, ctx)).sort((a, b) => (a.name < b.name ? -1 : 1));
  }, [assets, query, category, recent, favourites, byId]);

  const selectCategory = (id: string) => {
    setCategory(id);
    setQuery("");
    writeCat(id);
  };
  const onFav = (id: string) => setFavourites(toggleFavourite(id));

  return (
    <div className="flex h-full flex-col rounded-t-3xl border-t border-ink/10 bg-parchment shadow-[0_-8px_24px_rgba(70,54,90,.16)]">
      {/* Grab handle + search */}
      <div className="shrink-0 px-3 pt-2">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/15" />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets…"
              className="w-full rounded-full border border-ink/15 bg-white/80 py-2 pl-8 pr-3 text-sm text-ink focus:border-cobalt focus:outline-none"
            />
          </div>
          <button type="button" onClick={onClose} aria-label="Close assets" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink/60 hover:bg-ink/5">
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      {!query.trim() ? (
        <div className="shrink-0 px-2 pt-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {ASSET_CATEGORY_TREE.map((n) => {
              const active = n.id === category || n.children?.some((c) => c.id === category);
              return (
                <button key={n.id} type="button" onClick={() => selectCategory(n.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${active ? "bg-ink text-parchment" : "bg-white/70 text-ink/60 hover:text-ink/80"}`}>
                  {n.label}
                </button>
              );
            })}
          </div>
          {activeTop?.children ? (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {activeTop.children.map((c) => (
                <button key={c.id} type="button" onClick={() => selectCategory(c.id)} className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${c.id === category ? "border-cobalt bg-cobalt/15 text-cobalt" : "border-ink/15 text-ink/55 hover:border-ink/30"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Tiles */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {list.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink/45">
            {query.trim() ? "No assets match your search." : category === "favourites" ? "No favourites yet — tap the star on a tile." : category === "recent" ? "No recently added assets yet." : "No assets in this category."}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {list.map((a) => {
              const cls = classifyAsset(a);
              const fav = favourites.includes(a.id);
              return (
                <div key={a.id} className="group relative">
                  <button type="button" onClick={() => onAdd(a)} title={`Add ${a.name}`} className="block w-full rounded-xl border border-ink/12 bg-white/70 p-1.5 text-left transition hover:border-cobalt/60 hover:bg-white">
                    <div className="relative flex h-14 items-center justify-center overflow-hidden rounded-lg bg-parchment/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.thumbnailUrl} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                      {isAnimatedAsset(a) ? (
                        <span className="absolute bottom-1 left-1 rounded-full bg-cobalt/85 p-[3px]" title="Interactive / animated"><Sparkles className="h-2.5 w-2.5 text-white" /></span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-[10px] font-bold text-ink/75">{a.name}</p>
                    {advanced && a.placeholder ? <span className="mt-0.5 inline-block rounded bg-amber-400/30 px-1 text-[8px] font-bold uppercase text-amber-800">Placeholder</span> : <span className="text-[8px] uppercase tracking-wide text-ink/35">{cls.childCategory ?? cls.category}</span>}
                  </button>
                  <button type="button" onClick={() => onFav(a.id)} aria-label={fav ? "Unfavourite" : "Favourite"} aria-pressed={fav} className="absolute right-1 top-1 rounded-full bg-white/80 p-0.5 shadow-sm">
                    <Star className={`h-3.5 w-3.5 ${fav ? "fill-saffron text-saffron" : "text-ink/40"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
