// Feature flags for the creator-identity & engagement foundations.
//
// Each flag reads NEXT_PUBLIC_ENABLE_* so it resolves identically on the server
// and the client. Sprint 1 features default ON so they are usable out of the
// box; later-sprint features default OFF until they are built and enabled.
//
// Toggle in .env.local, e.g. NEXT_PUBLIC_ENABLE_GUESTBOOKS=false

export type FeatureFlag =
  | "ENABLE_CREATOR_PROFILES"
  | "ENABLE_NOTIFICATIONS"
  | "ENABLE_GUESTBOOKS"
  | "ENABLE_COLLECTIONS"
  | "ENABLE_ACTIVITY_FEED"
  | "ENABLE_ASSET_CATALOG"
  | "ENABLE_ROOM_ENGINE";

const defaults: Record<FeatureFlag, boolean> = {
  // Sprint 1 — implemented, on by default
  ENABLE_CREATOR_PROFILES: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_GUESTBOOKS: true,
  // Sprint 2 — implemented, on by default
  ENABLE_COLLECTIONS: true,
  ENABLE_ACTIVITY_FEED: true,
  ENABLE_ASSET_CATALOG: true,
  // Room Engine V1 — on by default; off falls back to the legacy room
  ENABLE_ROOM_ENGINE: true,
};

// next/font + Next inlines NEXT_PUBLIC_* at build time, so this lookup must use
// the full literal key rather than a computed `process.env[name]`.
const overrides: Record<FeatureFlag, string | undefined> = {
  ENABLE_CREATOR_PROFILES: process.env.NEXT_PUBLIC_ENABLE_CREATOR_PROFILES,
  ENABLE_NOTIFICATIONS: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS,
  ENABLE_GUESTBOOKS: process.env.NEXT_PUBLIC_ENABLE_GUESTBOOKS,
  ENABLE_COLLECTIONS: process.env.NEXT_PUBLIC_ENABLE_COLLECTIONS,
  ENABLE_ACTIVITY_FEED: process.env.NEXT_PUBLIC_ENABLE_ACTIVITY_FEED,
  ENABLE_ASSET_CATALOG: process.env.NEXT_PUBLIC_ENABLE_ASSET_CATALOG,
  ENABLE_ROOM_ENGINE: process.env.NEXT_PUBLIC_ENABLE_ROOM_ENGINE,
};

export function isEnabled(flag: FeatureFlag): boolean {
  const raw = overrides[flag];
  if (raw === undefined || raw === "") return defaults[flag];
  return raw === "true" || raw === "1";
}

export const flags = {
  creatorProfiles: isEnabled("ENABLE_CREATOR_PROFILES"),
  notifications: isEnabled("ENABLE_NOTIFICATIONS"),
  guestbooks: isEnabled("ENABLE_GUESTBOOKS"),
  collections: isEnabled("ENABLE_COLLECTIONS"),
  activityFeed: isEnabled("ENABLE_ACTIVITY_FEED"),
  assetCatalog: isEnabled("ENABLE_ASSET_CATALOG"),
  roomEngine: isEnabled("ENABLE_ROOM_ENGINE"),
};
