"use client";

import { useMemo, useState } from "react";
import { Armchair, Flower2, Home, Image as ImageIcon, Lamp, LayoutGrid, Search, Shapes, Sparkles, Square } from "lucide-react";
import { bazaars } from "@/lib/data";
import { catalogAssets, categoryLabels, placementLabels, rarityLabels, rarityStyles, statusStyles } from "@/lib/assets";
import type { AssetCategory, AssetStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const categoryIcons: Record<AssetCategory, typeof Home> = {
  furniture: Armchair,
  wall: Square,
  floor: LayoutGrid,
  plant: Flower2,
  lighting: Lamp,
  decor: Sparkles,
  structure: Home,
};

const villageName = (id: string) => (id === "any" ? "Any village" : bazaars.find((b) => b.id === id)?.name ?? id);

export function AssetsClient() {
  const [category, setCategory] = useState<AssetCategory | "all">("all");
  const [status, setStatus] = useState<AssetStatus | "all">("all");
  const [query, setQuery] = useState("");

  const categories = Object.keys(categoryLabels) as AssetCategory[];
  const statuses: AssetStatus[] = ["published", "draft", "retired"];

  const filtered = useMemo(() => {
    return catalogAssets.filter((asset) => {
      if (category !== "all" && asset.category !== category) return false;
      if (status !== "all" && asset.status !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${asset.name} ${asset.tags.join(" ")} ${asset.ownerHandle ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [category, status, query]);

  return (
    <div className="mt-8">
      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex max-w-md items-center gap-3 rounded-2xl border border-timber/15 bg-white px-4 shadow-soft">
          <Search size={18} className="text-ink/35" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets, tags, owners…" aria-label="Search assets" className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-ink/35" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", ...categories] as const).map((value) => (
            <button key={value} onClick={() => setCategory(value)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold transition", category === value ? "border-terracotta bg-terracotta text-white" : "border-timber/20 bg-parchment/70 text-ink-soft hover:border-terracotta")}>
              {value === "all" ? "All categories" : categoryLabels[value]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", ...statuses] as const).map((value) => (
            <button key={value} onClick={() => setStatus(value)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition", status === value ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink-soft hover:border-ink/40")}>
              {value === "all" ? "All statuses" : value}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-5 text-sm text-ink/50">{filtered.length} of {catalogAssets.length} assets</p>

      {filtered.length === 0 && (
        <div className="card mt-3 rounded-2xl p-10 text-center text-ink/55">No assets match these filters.</div>
      )}

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((asset) => {
          const Icon = categoryIcons[asset.category];
          return (
            <article key={asset.id} className="card overflow-hidden rounded-2xl">
              {/* Placeholder swatch — no real image uploads in this foundation */}
              <div className="relative grid h-28 place-items-center bg-gradient-to-br from-parchment to-parchment-deep">
                <Icon size={34} className="text-ink/30" />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-ink/45"><ImageIcon size={11} /> placeholder</span>
                <span className={cn("absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold", rarityStyles[asset.rarity])}>{rarityLabels[asset.rarity]}</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black leading-tight">{asset.name}</h3>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", statusStyles[asset.status])}>{asset.status}</span>
                </div>
                <p className="mt-1 text-xs text-ink/50">{categoryLabels[asset.category]} · {placementLabels[asset.placement]} placement</p>
                <p className="mt-0.5 text-xs text-ink/50">{villageName(asset.villageTheme)}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-ink/55">
                  <Shapes size={13} className="text-ink/35" />
                  {asset.ownerType === "system" ? "System asset" : `By ${asset.ownerHandle}`}
                </p>
                {asset.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {asset.tags.map((tag) => <span key={tag} className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-ink/50">{tag}</span>)}
                  </div>
                )}
                <p className="mt-2 truncate font-mono text-[10px] text-ink/30">{asset.id} · {asset.imageUrl}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
