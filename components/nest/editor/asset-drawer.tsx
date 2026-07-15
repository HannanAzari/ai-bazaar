"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Clock,
  Info,
  LayoutGrid,
  Lamp,
  Leaf,
  Plus,
  Search,
  Shapes,
  Sofa,
  Sparkles,
  Square,
  Star,
  Table,
  Trash2,
  Tv,
  User,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import {
  ASSET_CATEGORY_TREE,
  assetInCategory,
  classifyAsset,
  getFavourites,
  getRecent,
  isAiAsset,
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
  official: BadgeCheck,
  "my-assets": Wand2,
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
  onCreate,
  onDelete,
  focusAssetId,
  onClose,
  snap,
  onSnapChange,
}: {
  assets: LivingNestAsset[];
  advanced: boolean;
  onAdd: (asset: LivingNestAsset) => void;
  /** M32 — open the editor-first Create Asset flow (always the first tile). */
  onCreate?: () => void;
  /** Delete a (My Assets) asset. Only offered for AI-created assets. */
  onDelete?: (asset: LivingNestAsset) => void;
  /** A just-created asset to reveal: switch to My Assets, scroll to it, pulse once. */
  focusAssetId?: string;
  onClose: () => void;
  snap: BottomSheetSnapPoint;
  onSnapChange: (s: BottomSheetSnapPoint) => void;
}) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCategory(readCat());
    setFavourites(getFavourites());
    setRecent(getRecent());
  }, []);

  // M31 polish — when a new asset is created, take the user straight to it: switch
  // to My Assets, scroll it into view, and pulse it once so they never wonder
  // "where did it go?".
  useEffect(() => {
    if (!focusAssetId) return;
    setCategory("my-assets");
    setQuery("");
    writeCat("my-assets");
    const t = window.setTimeout(() => {
      const el = gridRef.current?.querySelector(`[data-asset-id="${focusAssetId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPulseId(focusAssetId);
      window.setTimeout(() => setPulseId(null), 1400);
    }, 120);
    return () => window.clearTimeout(t);
  }, [focusAssetId]);

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
          <div className="fade-in mb-2 flex items-center gap-2 rounded-2xl border border-cobalt/25 bg-white/85 p-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={details.thumbnailUrl} alt="" className="h-9 w-9 rounded-lg object-contain" draggable={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink">{details.name}</p>
              <p className="truncate text-[10px] text-ink/55">
                {isAiAsset(details) ? "My Asset" : "Official"}
                {" · "}
                {classifyAsset(details).childCategory ?? classifyAsset(details).category}
                {isAnimatedAsset(details) ? " · interactive" : ""}
              </p>
            </div>
            {/* Only My Assets can be deleted; Official is read-only. */}
            {onDelete && isAiAsset(details) ? (
              <button type="button" onClick={() => { onDelete(details); setDetailsId(null); }} aria-label={`Delete ${details.name}`} className="spring rounded-full p-1.5 text-rust/80 hover:bg-rust/10">
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <button type="button" onClick={() => setDetailsId(null)} aria-label="Dismiss details" className="spring rounded-full p-1.5 text-ink/45 hover:bg-ink/5">
              <Info className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* M32 — the Create Asset tile is ALWAYS first, in every category, never
            hidden behind another page: the factory lives inside the editor. */}
        <div ref={gridRef} className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
          {onCreate && !query.trim() ? <CreateAssetTile onCreate={onCreate} /> : null}
          {list.map((a) => (
            <AssetTile
              key={a.id}
              asset={a}
              advanced={advanced}
              favourite={favourites.includes(a.id)}
              pulse={pulseId === a.id}
              onAdd={() => onAdd(a)}
              onDetails={() => setDetailsId(a.id)}
              onFav={() => onFav(a.id)}
            />
          ))}
        </div>
        {list.length === 0 ? (
          <div className="fade-in px-6 py-10 text-center">
            {query.trim() ? (
              <p className="text-xs text-ink/45">No assets match your search.</p>
            ) : category === "favourites" ? (
              <p className="text-xs text-ink/45">No favourites yet — long-press a tile, then tap the star.</p>
            ) : category === "recent" ? (
              <p className="text-xs text-ink/45">Nothing here yet — the pieces you use will gather here.</p>
            ) : category === "my-assets" ? (
              <>
                <p className="text-sm font-bold text-ink/70">Every home starts with one favourite object.</p>
                <p className="mt-1 text-xs text-ink/45">Photograph something you love — we&apos;ll rebuild it as a Nestudio object.</p>
              </>
            ) : (
              <p className="text-xs text-ink/45">Nothing in this category yet.</p>
            )}
          </div>
        ) : null}
        <DrawerStyle />
      </div>
    </MobileBottomSheet>
  );
}

// M32 — the "+ Create Asset" tile. Same footprint as an asset tile so it reads as
// the first item in the sticker-keyboard grid; a warm dashed call-to-action.
function CreateAssetTile({ onCreate }: { onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      aria-label="Create asset"
      title="Create asset"
      className="create-tile spring flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-cobalt/45 bg-cobalt/8 text-cobalt transition hover:-translate-y-0.5 hover:border-cobalt/70 hover:bg-cobalt/14"
    >
      <Plus className="h-5 w-5" />
      <span className="text-[8px] font-black uppercase leading-none tracking-wide">Create</span>
    </button>
  );
}

// Motion + create-tile glow for the drawer grid.
function DrawerStyle() {
  return (
    <style>{`
      .spring{transition:transform 140ms cubic-bezier(0.2,0.8,0.2,1)}
      .spring:active{transform:scale(0.94)}
      .fade-in{animation:drwFade 260ms ease both}
      .tile-in{animation:drwPop 300ms cubic-bezier(0.2,1.1,0.35,1) both}
      .create-tile{box-shadow:0 0 0 0 rgba(47,111,214,0.0);animation:createGlow 2.6s ease-in-out infinite}
      .pulse-once{animation:drwPulse 1.3s ease-out both}
      @keyframes drwFade{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
      @keyframes drwPop{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}}
      @keyframes createGlow{0%,100%{box-shadow:0 0 0 0 rgba(47,111,214,0.0)}50%{box-shadow:0 0 12px 1px rgba(47,111,214,0.18)}}
      @keyframes drwPulse{0%{box-shadow:0 0 0 0 rgba(47,111,214,0.5);transform:scale(1)}30%{box-shadow:0 0 0 6px rgba(47,111,214,0.18);transform:scale(1.06)}100%{box-shadow:0 0 0 0 rgba(47,111,214,0);transform:scale(1)}}
      @media (prefers-reduced-motion:reduce){.fade-in,.tile-in,.create-tile,.pulse-once{animation:none!important}.spring{transition:none}}
    `}</style>
  );
}

// Image-first tile: no visible name/category. Tap adds; long-press reveals details +
// the favourite affordance. The accessible name carries the asset name for search/AT.
function AssetTile({
  asset,
  advanced,
  favourite,
  pulse,
  onAdd,
  onDetails,
  onFav,
}: {
  asset: LivingNestAsset;
  advanced: boolean;
  favourite: boolean;
  pulse?: boolean;
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
    <div className={`group relative tile-in ${pulse ? "pulse-once rounded-xl" : ""}`} data-asset-id={asset.id}>
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
        className="spring block aspect-square w-full overflow-hidden rounded-xl border border-ink/12 bg-white/70 p-1 transition hover:-translate-y-0.5 hover:border-cobalt/60 hover:bg-white hover:shadow-sm"
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
