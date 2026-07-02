// ── Nestudio V2 — composition overlap advisories (M7B.2) ────────────────────
//
// Lightweight, ADVISORY (never blocking) notes about visually implausible overlaps:
//   • the avatar standing inside tall furniture (e.g. a bookshelf),
//   • two large floor objects of the same kind stacked in the same spot,
//   • a wall object covering the window,
//   • a movable object covering built-in architecture (the niche).
//
// Tuned to be USEFUL not NOISY: it uses VISIBLE-content bounds, skips intentional
// support relationships (books on a table), requires high overlap, and deduplicates —
// so the normal Golden Living Nest layout (coffee table in front of sofa, avatar in
// the foreground) produces ZERO advisories. Pure + deterministic.

import type { EditableNestObject } from "@/lib/nest-editor-types";
import type { LivingNestAsset } from "@/lib/nest-visual-types";
import { slotTypeForAsset } from "@/lib/nest-editor-policy";
import { visibleRect } from "@/lib/nest-visual-bounds";
import {
  GOLDEN_LIVING_NEST_OCCUPIED_ZONES,
  occupiedZoneConflicts,
  overlapFraction,
  supportRuleForAsset,
  type NestOccupiedZone,
} from "@/lib/nest-placement";

export type OverlapAdvisoryKind = "avatar-furniture" | "floor-floor" | "wall-window" | "covers-builtin";

export interface OverlapAdvisory {
  instanceId: string;
  otherId?: string;
  kind: OverlapAdvisoryKind;
  message: string;
}

/** Tall furniture the avatar should not stand *inside* (front-facing collision). */
const TALL_FURNITURE = new Set(["shelf", "lamp", "plant", "desk"]);
/** Bulky floor furniture for the same-kind stacking check. */
const BULKY_FLOOR = new Set(["sofa", "media", "table", "desk", "shelf"]);

const name = (assetsById: Record<string, LivingNestAsset>, o: EditableNestObject) =>
  assetsById[o.assetId]?.name ?? o.assetId;

/** True when `a` legitimately rests on `b` (a needs a surface and b is a valid support). */
function isIntentionalSupport(
  a: EditableNestObject,
  b: EditableNestObject,
  assetsById: Record<string, LivingNestAsset>,
): boolean {
  const rule = supportRuleForAsset(assetsById[a.assetId]);
  if (!rule?.requiresSurface) return false;
  const bAsset = assetsById[b.assetId];
  if (rule.allowedSupportCategories && bAsset && !rule.allowedSupportCategories.includes(bAsset.category)) return false;
  const base = visibleRect(a, a.assetId);
  const top = visibleRect(b, b.assetId);
  const baseY = base.y + base.height;
  return baseY >= top.y - 0.08 && baseY <= top.y + top.height * 0.5;
}

/**
 * Advisory overlap notes for a document. Deterministic, deduplicated, and conservative.
 * `zones` defaults to the Golden Living Nest baked architecture.
 */
export function overlapAdvisories(
  objects: EditableNestObject[],
  assetsById: Record<string, LivingNestAsset>,
  zones: NestOccupiedZone[] = GOLDEN_LIVING_NEST_OCCUPIED_ZONES,
): OverlapAdvisory[] {
  const visible = objects.filter((o) => !o.hidden);
  const out: OverlapAdvisory[] = [];
  const seen = new Set<string>();
  const add = (adv: OverlapAdvisory) => {
    const key = `${adv.kind}:${[adv.instanceId, adv.otherId].sort().join("~")}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(adv);
  };

  // Pairwise overlaps (i<j so each pair is considered once).
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i];
      const b = visible[j];
      if (isIntentionalSupport(a, b, assetsById) || isIntentionalSupport(b, a, assetsById)) continue;
      const ra = visibleRect(a, a.assetId);
      const rb = visibleRect(b, b.assetId);
      const oa = overlapFraction(ra, rb); // fraction of a covered
      const ob = overlapFraction(rb, ra); // fraction of b covered
      const st = (o: EditableNestObject) => slotTypeForAsset(assetsById[o.assetId] ?? ({} as LivingNestAsset));
      const sa = st(a);
      const sb = st(b);

      // Avatar standing inside tall furniture (needs a deep overlap, not a foreground pass).
      const avatar = sa === "avatar" ? a : sb === "avatar" ? b : undefined;
      const furniture = avatar === a ? b : avatar === b ? a : undefined;
      if (avatar && furniture) {
        const fst = st(furniture);
        const avFrac = avatar === a ? oa : ob;
        if (fst && TALL_FURNITURE.has(fst) && avFrac > 0.55) {
          add({ instanceId: avatar.instanceId, otherId: furniture.instanceId, kind: "avatar-furniture", message: `Avatar overlaps ${name(assetsById, furniture)}` });
          continue;
        }
      }

      // Two large floor objects of the same kind stacked in the same place (e.g. two sofas).
      if (sa && sb && sa === sb && BULKY_FLOOR.has(sa) && Math.max(oa, ob) > 0.6) {
        add({ instanceId: a.instanceId, otherId: b.instanceId, kind: "floor-floor", message: `${name(assetsById, a)} overlaps another ${name(assetsById, b)}` });
      }
    }
  }

  // Object covering baked architecture (window / built-in niche).
  for (const o of visible) {
    for (const z of occupiedZoneConflicts(o, zones)) {
      if (z.purpose === "window") {
        add({ instanceId: o.instanceId, kind: "wall-window", message: `${name(assetsById, o)} overlaps the window` });
      } else if (z.purpose === "built_in_storage" || z.purpose === "architecture") {
        add({ instanceId: o.instanceId, kind: "covers-builtin", message: `${name(assetsById, o)} covers the ${z.name.toLowerCase()}` });
      }
    }
  }

  return out;
}
