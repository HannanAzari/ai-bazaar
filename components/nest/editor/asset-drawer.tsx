"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Info,
  LayoutGrid,
  Lamp,
  Leaf,
  Search,
  Shapes,
  Sofa,
  Sparkles,
  Square,
  Star,
  Table,
  Tv,
  User,
  type LucideIcon,
} from "lucide-react";
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
import { productionStatusFor } from "@/lib/nest-asset-calibration";
import { MobileBottomSheet, type BottomSheetSnapPoint } from "@/components/nest/editor/mobile-bottom-sheet";

// Telegram-inspired (NOT branded) asset library: a dense, IMAGE-FIRST grid like a
// sticker/emoji keyboard, inside the shared bottom sheet. Names + category labels are
// hidden under every tile by default (they remain in the accessible name, search, and a
// long-press details card) so far more assets fit on screen. Category navigation uses
// compact icons with accessible labels; Recent + Favourites stay prominent. Snap points
// come from the shared sheet (collapsed strip → half → full library).

const CAT_KEY = "nestudio:nest-editor:v1:drawer-category";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  all: LayoutGrid,
  recent: Clock,
  favourites: Star,
  seating: Sofa,
  tables: Table,
  media: Tv,
  lighting: Lamp,
  plants: Leaf,
  decor: Shapes,
  avatars: User,
  floor: Square,
  animated: Sparkles,
};

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

function topFor(categoryId: string): AssetCategoryNode | undefined {
  return ASSET_CATEGORY_TREE.find((n) => n.id === categoryId || n.children?.some((c) => c.id === categoryId));
}

export function AssetDrawer({
  assets,
  advanced,
  onAdd,
  onClose,
  snap,
  onSnapChange,
}: {
  assets: LivingNestAsset[];
  advanced: boolean;
  onAdd: (asset: LivingNestAsset) => void;
  onClose: () => void;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
}) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [detailsId, setDetailsId] = useState<string | null>(null);

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
    setDetailsId(null);
    writeCat(id);
  };
  const onFav = (id: string) => setFavourites(toggleFavourite(id));
  const details = detailsId ? byId[detailsId] : null;

  const header = (
    <div className="px-3 pb-1 pt-1">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets…"
            aria-label="Search assets"
            className="w-full rounded-full border border-ink/15 bg-white/80 py-2 pl-8 pr-3 text-sm text-ink focus:border-cobalt focus:outline-none"
          />
        </div>
      </div>

      {/* Compact icon category strip (Recent + Favourites stay prominent) */}
      {!query.trim() ? (
        <>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {ASSET_CATEGORY_TREE.map((n) => {
              const active = n.id === category || n.children?.some((c) => c.id === category);
              const Icon = CATEGORY_ICON[n.id] ?? LayoutGrid;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => selectCategory(n.id)}
                  aria-label={n.label}
                  aria-pressed={active}
                  title={n.label}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${active ? "bg-ink text-parchment" : "bg-white/70 text-ink/55 hover:text-ink/80"}`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span className="sr-only">{n.label}</span>
                </button>
              );
            })}
          </div>
          {activeTop?.children ? (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {activeTop.children.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCategory(c.id)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${c.id === category ? "border-cobalt bg-cobalt/15 text-cobalt" : "border-ink/15 text-ink/55 hover:border-ink/30"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );

  return (
    <MobileBottomSheet
      open
      snap={snap}
      onSnapChange={onSnapChange}
      onClose={onClose}
      backdrop="transparent"
      label="Asset library"
      header={header}
      visible={{ collapsed: 0.2 }}
    >
      <div className="px-3 pb-4 pt-1">
        {/* Long-press details card (name / category / status / interaction) */}
        {details ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-cobalt/30 bg-white/80 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={details.thumbnailUrl} alt="" className="h-9 w-9 rounded object-contain" draggable={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink">{details.name}</p>
              <p className="truncate text-[10px] text-ink/55">
                {classifyAsset(details).childCategory ?? classifyAsset(details).category}
                {" · "}
                {productionStatusFor(details.id)}
                {isAnimatedAsset(details) ? " · interactive" : ""}
              </p>
            </div>
            <button type="button" onClick={() => setDetailsId(null)} aria-label="Dismiss details" className="rounded-full p-1 text-ink/45 hover:bg-ink/5">
              <Info className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {list.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink/45">
            {query.trim() ? "No assets match your search." : category === "favourites" ? "No favourites yet — long-press a tile, then tap the star." : category === "recent" ? "No recently added assets yet." : "No assets in this category."}
          </p>
        ) : (
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
            {list.map((a) => (
              <AssetTile
                key={a.id}
                asset={a}
                advanced={advanced}
                favourite={favourites.includes(a.id)}
                onAdd={() => onAdd(a)}
                onDetails={() => setDetailsId(a.id)}
                onFav={() => onFav(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    </MobileBottomSheet>
  );
}

// Image-first tile: no visible name/category. Tap adds; long-press reveals details +
// the favourite affordance. The accessible name carries the asset name for search/AT.
function AssetTile({
  asset,
  advanced,
  favourite,
  onAdd,
  onDetails,
  onFav,
}: {
  asset: LivingNestAsset;
  advanced: boolean;
  favourite: boolean;
  onAdd: () => void;
  onDetails: () => void;
  onFav: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);
  const status = productionStatusFor(asset.id);
  const animated = isAnimatedAsset(asset);

  const start = () => {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      onDetails();
    }, 420);
  };
  const clear = () => clearTimeout(timer.current);

  return (
    <div className="group relative">
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onAdd();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onDetails();
        }}
        aria-label={`Add ${asset.name}`}
        title={asset.name}
        className="block aspect-square w-full overflow-hidden rounded-xl border border-ink/12 bg-white/70 p-1 transition hover:border-cobalt/60 hover:bg-white"
      >
        <span className="relative flex h-full w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.thumbnailUrl} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
          {/* Compact corner badges only */}
          {animated ? (
            <span className="absolute bottom-0 left-0 rounded-full bg-cobalt/85 p-[3px]" title="Interactive / animated">
              <Sparkles className="h-2.5 w-2.5 text-white" />
            </span>
          ) : null}
          {advanced && status === "placeholder" ? (
            <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" title="Placeholder art" />
          ) : null}
          {status === "premium" ? (
            <span className="absolute right-0 top-0 rounded bg-cobalt px-1 text-[7px] font-black uppercase text-white" title="Premium">★</span>
          ) : null}
          <span className="sr-only">{asset.name}</span>
        </span>
      </button>
      {/* Favourite affordance is subtle — only shown once an asset is starred or on hover/focus */}
      <button
        type="button"
        onClick={onFav}
        aria-label={favourite ? `Unfavourite ${asset.name}` : `Favourite ${asset.name}`}
        aria-pressed={favourite}
        className={`absolute -right-1 -top-1 rounded-full bg-white/90 p-0.5 shadow-sm transition ${favourite ? "opacity-100" : "opacity-0 focus:opacity-100 group-hover:opacity-100"}`}
      >
        <Star className={`h-3 w-3 ${favourite ? "fill-saffron text-saffron" : "text-ink/40"}`} />
      </button>
    </div>
  );
}
