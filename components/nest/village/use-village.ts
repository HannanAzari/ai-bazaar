"use client";

import { useEffect, useMemo, useState } from "react";
import { useDiscovery } from "@/components/nest/app-shell/use-discovery";
import { deriveHouse, houseFromItems, type House } from "@/lib/nest-house";
import { buildVillage, type Village } from "@/lib/nest-village";
import { nestBackend } from "@/lib/nest-repo";
import { listCreators, type CreatorProfile } from "@/lib/nest/supabase-profile-repo";
import type { DiscoveryItem } from "@/lib/nest-discovery";

// M19 → M23B — the live Village.
//
// A creator owns ONE house; their published Nests are rooms inside it. That grouping was
// already right — what was wrong is that it was fed from one browser's localStorage, and
// that a creator with no published Nest yet had no house at all.
//
// Now: real creators come from the shared `profiles` table (so a creator who has just
// finished onboarding is already on the street), their published Nests attach to them,
// and the house you see is the one they SELECTED in onboarding.

function housesFromDiscovery(items: DiscoveryItem[]): { real: House[]; showHomes: House[] } {
  const byCreator = new Map<string, DiscoveryItem[]>();
  const showHomes: House[] = [];

  for (const it of items) {
    if (it.source === "published") {
      const key = it.creator.id ?? it.creator.username ?? it.title;
      const list = byCreator.get(key);
      if (list) list.push(it);
      else byCreator.set(key, [it]);
    } else {
      // curated / demo → an enterable example home (not a real creator's house)
      showHomes.push({
        ...deriveHouse({
          creator: { displayName: it.title },
          persona: it.category,
          nestHref: it.href,
          latestNestTitle: it.title,
        }),
        isReal: false,
      });
    }
  }

  const real = Array.from(byCreator.values())
    .map(houseFromItems)
    .filter((h): h is House => h !== null);

  return { real, showHomes };
}

/** A creator with no published Nest yet still lives somewhere — their door just doesn't open. */
function houseFromCreator(c: CreatorProfile): House {
  return deriveHouse({
    creator: { id: c.id, username: c.username, displayName: c.displayName, houseStyle: c.houseStyle },
    houseStyle: c.houseStyle,
    bio: c.bio,
  });
}

export function useVillage(targetCount = 20): { village: Village; realCount: number } {
  const { items } = useDiscovery();
  const [creators, setCreators] = useState<CreatorProfile[]>([]);

  useEffect(() => {
    if (nestBackend() !== "supabase") return;
    let alive = true;
    void listCreators()
      .then((rows) => { if (alive) setCreators(rows); })
      // The Village degrades to "creators who have published" rather than breaking — the
      // feed's own error surface already reports a backend outage loudly.
      .catch(() => { if (alive) setCreators([]); });
    return () => { alive = false; };
  }, []);

  return useMemo(() => {
    const { real, showHomes } = housesFromDiscovery(items);
    // A creator who already has a house from their Nests wins — that house knows which
    // Nest to enter. Everyone else gets a door that leads to their profile.
    const seen = new Set(real.map((h) => h.ownerId ?? h.id));
    const extra = creators.filter((c) => !seen.has(c.id)).map(houseFromCreator);
    const houses = [...real, ...extra, ...showHomes];
    const realCount = houses.filter((h) => h.isReal).length;
    return { village: buildVillage(houses, { targetCount }), realCount };
  }, [items, creators, targetCount]);
}
