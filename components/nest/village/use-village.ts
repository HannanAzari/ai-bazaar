"use client";

import { useMemo } from "react";
import { useDiscovery } from "@/components/nest/app-shell/use-discovery";
import { deriveHouse, houseFromItems, type House } from "@/lib/nest-house";
import { buildVillage, type Village } from "@/lib/nest-village";
import type { DiscoveryItem } from "@/lib/nest-discovery";

// M19 — turns the live discovery items into a Village of Houses. A creator owns ONE
// house (their published Nests are rooms inside it), curated examples become enterable
// "show homes", and generated neighbors fill the neighborhood out to a cozy size.
function housesFromDiscovery(items: DiscoveryItem[]): House[] {
  const byCreator = new Map<string, DiscoveryItem[]>();
  const showHomes: House[] = [];

  for (const it of items) {
    if (it.source === "published") {
      const key = it.creator.id ?? it.creator.username ?? it.title;
      (byCreator.get(key) ?? byCreator.set(key, []).get(key)!).push(it);
    } else {
      // curated / demo → an enterable example home (not a real creator's house)
      showHomes.push({
        ...deriveHouse({ creator: { displayName: it.title }, persona: it.category, nestHref: it.href, latestNestTitle: it.title }),
        isReal: false,
      });
    }
  }

  const real = Array.from(byCreator.values())
    .map(houseFromItems)
    .filter((h): h is House => h !== null);

  return [...real, ...showHomes];
}

export function useVillage(targetCount = 20): { village: Village; realCount: number } {
  const { items } = useDiscovery();
  return useMemo(() => {
    const houses = housesFromDiscovery(items);
    const realCount = houses.filter((h) => h.isReal).length;
    return { village: buildVillage(houses, { targetCount }), realCount };
  }, [items, targetCount]);
}
