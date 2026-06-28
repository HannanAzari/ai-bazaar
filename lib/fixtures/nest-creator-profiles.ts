// ── Nestudio V2 — demo creator profiles (M4) ────────────────────────────────
//
// Three structured `CreatorNestProfile` fixtures used to prove the deterministic
// Nest Composer: a Technology Founder, a Musician, and a Photographer. Each feeds
// `composeNest` and produces a valid, personalised `ComposedNest` against the
// locked Golden Nest V2 template — different content, same seven-object stage.
//
// All URLs are safe placeholders (example.com / example.org). Content `priority`
// is the creator's own ranking (lower = more important) and is a deterministic
// tie-break signal only — never randomness. Reference/test data; nothing is
// persisted or generated at runtime.

import type { CreatorNestProfile } from "@/lib/nest-composer-types";

// ── Profile A — Technology Founder ───────────────────────────────────────────
// Content: YouTube · website · two articles · gallery · bio. Ambience: golden evening.
// Expected: TV→YouTube · Books→article · Frame→gallery · Avatar→bio · website + the
// second article survive as quick links.
export const PROFILE_FOUNDER: CreatorNestProfile = {
  id: "creator-founder",
  displayName: "Ada — Technology Founder",
  creatorTypes: ["founder", "developer", "writer"],
  interests: ["AI", "startups", "product building", "coffee"],
  personalityTags: ["warm", "ambitious", "focused", "minimal"],
  preferredAmbienceId: "golden_evening",
  accessLevel: "public",
  contentSources: [
    { id: "src-yt", type: "youtube", title: "My YouTube channel", url: "https://example.com/founder/youtube", priority: 1 },
    { id: "src-site", type: "website", title: "Personal website", url: "https://example.com/founder", priority: 2 },
    { id: "src-essay-1", type: "article", title: "How we built it", url: "https://example.com/founder/build", priority: 3 },
    { id: "src-essay-2", type: "article", title: "On focus", url: "https://example.com/founder/focus", priority: 4 },
    { id: "src-gallery", type: "gallery", title: "Photo gallery", url: "https://example.com/founder/gallery", priority: 5 },
    { id: "src-bio", type: "bio", title: "Hi, I'm Ada", url: "https://example.com/founder/about", priority: 6 },
  ],
};

// ── Profile B — Musician ─────────────────────────────────────────────────────
// Content: music video · Spotify · Instagram gallery · website · bio. Ambience: cozy night.
// Expected: TV→music video · Frame→Instagram · Avatar→bio · Spotify + website survive as
// quick links (no compatible object — and we never invent a guitar asset).
export const PROFILE_MUSICIAN: CreatorNestProfile = {
  id: "creator-musician",
  displayName: "Theo — Musician",
  creatorTypes: ["musician", "songwriter"],
  interests: ["guitar", "live music", "recording"],
  personalityTags: ["creative", "expressive", "calm"],
  preferredAmbienceId: "cozy_night",
  accessLevel: "public",
  contentSources: [
    { id: "src-mv", type: "video", title: "Latest music video", url: "https://example.com/musician/video", priority: 1 },
    { id: "src-spotify", type: "spotify", title: "Listen on Spotify", url: "https://example.com/musician/spotify", priority: 2 },
    { id: "src-ig", type: "instagram", title: "Instagram", url: "https://example.com/musician/instagram", priority: 3 },
    { id: "src-site", type: "website", title: "Official site", url: "https://example.com/musician", priority: 4 },
    { id: "src-bio", type: "bio", title: "About Theo", url: "https://example.com/musician/about", priority: 5 },
  ],
};

// ── Profile C — Photographer ─────────────────────────────────────────────────
// Content: gallery · Instagram · portfolio website · YouTube reel · bio. Ambience: warm day.
// Expected: Frame→gallery · TV→YouTube reel · Avatar→bio · portfolio + Instagram retained
// as quick links.
export const PROFILE_PHOTOGRAPHER: CreatorNestProfile = {
  id: "creator-photographer",
  displayName: "Mira — Photographer",
  creatorTypes: ["photographer", "traveller"],
  interests: ["landscapes", "portraits", "travel"],
  personalityTags: ["curious", "calm", "visual"],
  preferredAmbienceId: "warm_day",
  accessLevel: "public",
  contentSources: [
    { id: "src-gallery", type: "gallery", title: "Featured gallery", url: "https://example.com/photographer/gallery", priority: 1 },
    { id: "src-ig", type: "instagram", title: "Instagram", url: "https://example.com/photographer/instagram", priority: 2 },
    { id: "src-portfolio", type: "website", title: "Portfolio", url: "https://example.com/photographer", priority: 3 },
    { id: "src-reel", type: "youtube", title: "YouTube reel", url: "https://example.com/photographer/reel", priority: 4 },
    { id: "src-bio", type: "bio", title: "About Mira", url: "https://example.com/photographer/about", priority: 5 },
  ],
};

/** All three demo profiles, keyed by id for the internal Composer demo route. */
export const NEST_CREATOR_PROFILES: CreatorNestProfile[] = [
  PROFILE_FOUNDER,
  PROFILE_MUSICIAN,
  PROFILE_PHOTOGRAPHER,
];

export const NEST_CREATOR_PROFILES_BY_ID: Record<string, CreatorNestProfile> =
  NEST_CREATOR_PROFILES.reduce<Record<string, CreatorNestProfile>>((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});
