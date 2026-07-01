// ── Golden Nest V2 — composition policy (M4) ────────────────────────────────
//
// The typed, deterministic policy the Nest Composer composes the Golden Nest V2
// template *to*. It is data only — no logic, no randomness. It encodes the locked
// seven-object presentation:
//
//   required (always filled): frame · media · desk · avatar   (the 4 primary slots)
//   optional (filled, ambient): lamp · plant · books          (complete the room)
//   excluded:                   bookshelf                      (the baked right-side
//                               niche reads as architecture — keep it empty)
//
//   4 required + 3 optional = 7 active objects = maxObjects. The bookshelf slot +
//   asset stay in the library/template for future use but are never composed.
//
// Per-slot content priorities deviate intentionally from the production-bible's
// *example* priorities so the three demo profiles produce the documented bindings:
//   - desk is non-interactive in V2 (no interaction on the slot or the desk asset),
//     so it carries NO creator content — a website surfaces as a quick link.
//   - books binds an `article` only (not a website), so a creator with no article
//     keeps their website/portfolio as a quick link.
// See docs/nest-composer-v1.md for the full rationale.
//
// Additive: imports the V2 fixture + the Composer contract; touches no V1 code and
// does not alter the locked V2 art, slots, or camera.

import type { NestCompositionPolicy } from "@/lib/nest-composer-types";

export const GOLDEN_NEST_V2_POLICY: NestCompositionPolicy = {
  templateId: "golden-nest-v2",
  maxObjects: 7,

  // The identity-driving slots — every composition must fill all four.
  requiredSlotIds: ["slot-frame", "slot-media", "slot-desk", "slot-avatar"],

  // Ambient slots — filled because the policy supplies a fallback asset for each
  // (an explicit curation decision that completes the locked room), never to pad
  // the object count.
  optionalSlotIds: ["slot-lamp", "slot-plant", "slot-books"],

  // The baked right-wall niche is the architectural storage — leave the bookshelf
  // slot empty (asset + slot retained for future use).
  excludedSlotIds: ["slot-bookshelf"],

  contentRules: [
    // Hero media → the creator's primary moving image.
    { slotId: "slot-media", contentPriority: ["youtube", "video", "tiktok"], bindContentType: "video" },
    // Wall frame → the creator's visual portfolio.
    { slotId: "slot-frame", contentPriority: ["gallery", "instagram"], bindContentType: "gallery" },
    // Books → long-form writing only (a website is NOT a book — it stays a quick link).
    { slotId: "slot-books", contentPriority: ["article"], bindContentType: "article" },
    // Avatar → the creator's intro/bio.
    { slotId: "slot-avatar", contentPriority: ["bio"], bindContentType: "intro" },
    // (slot-desk omitted on purpose — non-interactive, binds no content.)
    // (slot-lamp / slot-plant omitted — ambience / ambient decoration only.)
  ],

  fallbackAssetBySlot: {
    "slot-frame": "ast-framed-photo",
    "slot-media": "ast-tv",
    "slot-lamp": "ast-floor-lamp",
    "slot-desk": "ast-desk",
    "slot-plant": "ast-potted-plant",
    "slot-books": "ast-stacked-books",
    "slot-avatar": "ast-avatar",
  },

  fallbackAmbienceId: "warm_day",
  allowAssetReuse: false,
};
