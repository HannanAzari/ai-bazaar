import { type AssetCandidate, type AssetPack, type FactoryCategory } from "@/lib/types";

// Five starter validation packs (Task 2). Built by selecting approved candidates by
// category theme — decoupled from exact ids so they stay valid as sample data
// evolves. "Realistic approved assets plus placeholders" = the approved sample set.

const BASE_TIME = Date.UTC(2026, 5, 17, 9, 0, 0);

type PackSpec = {
  slug: string;
  name: string;
  description: string;
  theme: string;
  categories: FactoryCategory[];
  limit: number;
};

const PACK_SPECS: PackSpec[] = [
  {
    slug: "cozy-creator",
    name: "Cozy Creator Pack",
    description: "Warm, lived-in essentials for a personal creator room.",
    theme: "cozy",
    categories: ["chair", "sofa", "rug", "plant", "lamp", "shelf", "wall_art", "book", "table"],
    limit: 9,
  },
  {
    slug: "photographer-studio",
    name: "Photographer Studio Pack",
    description: "Gallery walls, screens, and displays for a photography studio.",
    theme: "photography",
    categories: ["camera", "wall_art", "tv_screen", "product_display", "plant", "shelf"],
    limit: 8,
  },
  {
    slug: "podcaster",
    name: "Podcaster Pack",
    description: "Mics, seating, and screens for a cozy podcast lounge.",
    theme: "podcast",
    categories: ["microphone", "podcast_setup", "sofa", "shelf", "plant", "lamp"],
    limit: 8,
  },
  {
    slug: "cafe",
    name: "Cafe Pack",
    description: "Counters, tables, and signage for a welcoming cafe.",
    theme: "cafe",
    categories: ["cafe_counter", "restaurant_table", "sign", "plant", "bench", "market_stall", "lantern"],
    limit: 8,
  },
  {
    slug: "startup-workspace",
    name: "Startup Workspace Pack",
    description: "Desks, screens, and storage for a focused startup workspace.",
    theme: "workspace",
    categories: ["desk", "computer", "shelf", "lamp", "sign", "table", "wall_art"],
    limit: 8,
  },
];

/** Build the five starter packs from a candidate set (approved assets only). */
export function buildSamplePacks(candidates: AssetCandidate[]): AssetPack[] {
  const approved = candidates.filter((c) => c.status === "approved");
  return PACK_SPECS.map((spec, i) => {
    const assetIds = spec.categories
      .flatMap((cat) => approved.filter((c) => c.category === cat).map((c) => c.id))
      .slice(0, spec.limit);
    return {
      id: `pack-${spec.slug}`,
      slug: spec.slug,
      name: spec.name,
      description: spec.description,
      theme: spec.theme,
      status: "ready",
      assetIds,
      createdAt: new Date(BASE_TIME + i * 60_000).toISOString(),
    };
  });
}
