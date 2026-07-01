"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { LivingNestAsset, LivingNestSlotType } from "@/lib/nest-visual-types";

// The categorised asset-library tray. Shows approved assets grouped by category
// with a thumbnail, name, category, an interaction-capability dot, and a visible
// internal-only "Placeholder" badge on non-production art. Adding a card creates a
// new instance via the editor's deterministic addObject (handled by the parent).

const CATEGORY_ORDER = ["Seating", "Tables", "Media", "Lighting", "Plants", "Decor", "Avatar", "Floor"] as const;
type TrayCategory = (typeof CATEGORY_ORDER)[number];

function trayCategory(asset: LivingNestAsset): TrayCategory {
  const st: LivingNestSlotType | undefined = asset.compatibleSlotTypes[0];
  switch (st) {
    case "sofa":
      return "Seating";
    case "table":
    case "side_table":
    case "desk":
      return "Tables";
    case "media":
      return "Media";
    case "lamp":
      return "Lighting";
    case "plant":
      return "Plants";
    case "rug":
      return "Floor";
    case "avatar":
      return "Avatar";
    case "frame":
    case "books":
    case "shelf":
    default:
      return "Decor";
  }
}

export function AssetTray({
  assets,
  onAdd,
}: {
  assets: LivingNestAsset[];
  onAdd: (asset: LivingNestAsset) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<TrayCategory, LivingNestAsset[]>();
    for (const a of assets) {
      const c = trayCategory(a);
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(a);
    }
    Array.from(map.values()).forEach((list) => list.sort((x, y) => (x.id < y.id ? -1 : 1)));
    return map;
  }, [assets]);

  return (
    <div className="space-y-3">
      {CATEGORY_ORDER.filter((c) => groups.get(c)?.length).map((cat) => (
        <div key={cat}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink/45">{cat}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {groups.get(cat)!.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onAdd(a)}
                className="group relative w-[84px] shrink-0 rounded-xl border border-ink/15 bg-white/60 p-1.5 text-left transition hover:border-cobalt/60 hover:bg-white"
                title={`Add ${a.name}`}
              >
                <div className="relative flex h-14 items-center justify-center overflow-hidden rounded-lg bg-parchment/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.thumbnailUrl} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                  {a.defaultInteractionId ? (
                    <span className="absolute right-1 top-1 rounded-full bg-cobalt/90 p-0.5" title="Interactive">
                      <Sparkles className="h-2.5 w-2.5 text-white" />
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[10px] font-bold text-ink/80">{a.name}</p>
                <p className="truncate text-[8px] uppercase tracking-wide text-ink/40">{cat}</p>
                {a.placeholder ? (
                  <span className="mt-0.5 inline-block rounded bg-amber-400/30 px-1 text-[8px] font-bold uppercase text-amber-800">Placeholder</span>
                ) : (
                  <span className="mt-0.5 inline-block rounded bg-meadow/30 px-1 text-[8px] font-bold uppercase text-meadow-shade">Approved</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
