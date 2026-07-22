/**
 * lib/asset-pipeline/calibration-review.ts — the calibration SCIENTIFIC review framework.
 * -----------------------------------------------------------------------------
 * Phase 2, Sprint 1. Calibration is not asset-making — it is LEARNING. Each object is a
 * controlled experiment: a HYPOTHESIS, a fixed set of REVIEW CRITERIA, and a NUMERIC
 * SCORECARD along three axes, rolling up to a Pass/Fail RECOMMENDATION.
 *
 *   • DNA score      — does it obey the Nestudio rendering language? (camera, light, form)
 *   • Material score — does it read as its DECLARED material, with zero wooden bleed? (the Sprint-1 focus)
 *   • Family score   — does it belong beside the other Nestudio objects as ONE family?
 *
 * The rubric is SHARED across every object on purpose — a constant control, so objects are
 * comparable. Only the hypothesis + object-specific probes vary. The HUMAN scores each
 * criterion by eye (0 fail · 1 partial · 2 pass); this module only does the arithmetic and
 * the verdict. Nothing is auto-scored.
 *
 * PURE DATA + PURE FUNCTIONS — no DOM, no SDK. Usable in a route, a test, a script, the client.
 */

/** Per-criterion scale: 0 = fails, 1 = partial, 2 = fully passes. */
export const SCORE_MAX = 2;

export type CriterionScore = 0 | 1 | 2;

export type ReviewCriterion = {
  id: string;
  label: string;
  /** What "2 / pass" actually looks like — removes reviewer ambiguity. */
  passLooksLike: string;
  /** A 0 on a critical criterion fails the whole axis, regardless of the total. */
  critical?: boolean;
};

export type AxisKey = "dna" | "material" | "family";

export type ReviewAxis = {
  key: AxisKey;
  label: string;
  /** The one question this axis answers. */
  question: string;
  criteria: ReviewCriterion[];
  /** The axis passes at or above this percentage (and with no critical zero). */
  passPct: number;
  /** Relative weight in the overall (weighted) score. */
  weight: number;
};

/* ── The three axes (the shared control) ───────────────────────────────────────── */

export const DNA_AXIS: ReviewAxis = {
  key: "dna",
  label: "DNA",
  question: "Does it obey the Nestudio rendering language?",
  passPct: 80,
  weight: 0.3,
  criteria: [
    {
      id: "dna-camera",
      label: "Canonical camera",
      passLooksLike: "front-facing, slightly elevated ~10° tilt; never eye-level, isometric, rotated or dramatic",
      critical: true,
    },
    {
      id: "dna-light",
      label: "Light & AO",
      passLooksLike: "one soft warm upper-left key + gentle internal ambient occlusion; NO drop/cast/contact shadow, no halo",
    },
    {
      id: "dna-silhouette",
      label: "Silhouette",
      passLooksLike: "recognisable as the object from the outline alone (the 3-second read)",
    },
    {
      id: "dna-shape",
      label: "Shape language",
      passLooksLike: "softly rounded, gently inflated, iconic glyph — not a photoreal replica and not flat",
    },
    {
      id: "dna-alpha",
      label: "Transparency & edge",
      passLooksLike: "true clean alpha, gently soft edge, no checker, no fringe, no baked background",
    },
    {
      id: "dna-framing",
      label: "Framing & padding",
      passLooksLike: "centred at ~62% with generous even margins; nothing clipped or touching an edge",
    },
  ],
};

export const MATERIAL_AXIS: ReviewAxis = {
  key: "material",
  label: "Material",
  question: "Does it read as its declared material, with zero wooden bleed?",
  passPct: 90, // the Sprint-1 focus — the bar is highest here
  weight: 0.4,
  criteria: [
    {
      id: "mat-truth",
      label: "Material truth",
      passLooksLike: "the body reads unmistakably as its DECLARED material (metal reads as brushed metal, glass as glass)",
      critical: true,
    },
    {
      id: "mat-no-wood",
      label: "No wooden bleed",
      passLooksLike: "zero wooden / warm-beige / antique / carved-timber contamination on a non-timber object",
      critical: true,
    },
    {
      id: "mat-accents",
      label: "Accent parts",
      passLooksLike: "each accent reads correctly — a screen is dark emissive glass, a lens is glass, a grip is polymer",
    },
    {
      id: "mat-palette",
      label: "Palette",
      passLooksLike: "the object keeps its own true colours; warmth lives only in the light, never painted onto the material",
    },
    {
      id: "mat-finish",
      label: "Finish",
      passLooksLike: "matte-leaning but material-appropriate sheen; not a glossy toy and not a wet product-shot",
    },
  ],
};

export const FAMILY_AXIS: ReviewAxis = {
  key: "family",
  label: "Family",
  question: "Does it belong beside the other Nestudio objects as one family?",
  passPct: 80,
  weight: 0.3,
  criteria: [
    {
      id: "fam-belongs",
      label: "Belongs",
      passLooksLike: "sits believably beside the official Nestudio sofa, table and lamp — clearly the same world",
      critical: true,
    },
    {
      id: "fam-consistency",
      label: "Consistency",
      passLooksLike: "same camera, scale and lighting as its siblings — no drift",
    },
    {
      id: "fam-stylization",
      label: "Stylisation level",
      passLooksLike: "the same iconic / simplified level as the family — not markedly more or less detailed",
    },
    {
      id: "fam-warmth",
      label: "Warmth & soul",
      passLooksLike: "premium, calm and warm — it feels like a Nestudio object, not a stock 3D model",
    },
  ],
};

export const REVIEW_AXES: ReviewAxis[] = [DNA_AXIS, MATERIAL_AXIS, FAMILY_AXIS];

/** Every criterion id in one flat list (for building a blank scorecard). */
export function allCriterionIds(): string[] {
  return REVIEW_AXES.flatMap((a) => a.criteria.map((c) => c.id));
}

/* ── Scoring (pure arithmetic — the human supplies the scores) ─────────────────── */

/** A scorecard: criterion id → score. Missing keys = not yet scored. */
export type Scores = Record<string, CriterionScore | undefined>;

export type AxisResult = {
  key: AxisKey;
  label: string;
  earned: number;
  max: number;
  /** Percentage of the maximum (unscored criteria count as 0 until scored). */
  pct: number;
  /** All criteria on this axis have been scored. */
  complete: boolean;
  /** A critical criterion was scored 0. */
  criticalFail: boolean;
  /** True when complete, at/above passPct, and no critical zero. */
  pass: boolean;
};

export function scoreAxis(axis: ReviewAxis, scores: Scores): AxisResult {
  let earned = 0;
  let scored = 0;
  let criticalFail = false;
  for (const c of axis.criteria) {
    const s = scores[c.id];
    if (s === undefined) continue;
    scored += 1;
    earned += s;
    if (c.critical && s === 0) criticalFail = true;
  }
  const max = axis.criteria.length * SCORE_MAX;
  const pct = max === 0 ? 0 : Math.round((earned / max) * 100);
  const complete = scored === axis.criteria.length;
  return {
    key: axis.key,
    label: axis.label,
    earned,
    max,
    pct,
    complete,
    criticalFail,
    pass: complete && !criticalFail && pct >= axis.passPct,
  };
}

export type Verdict = {
  axes: AxisResult[];
  dna: AxisResult;
  material: AxisResult;
  family: AxisResult;
  /** Weighted overall percentage across the three axes. */
  overallPct: number;
  /** Every axis scored. */
  complete: boolean;
  /** The recommendation: PASS only when every axis passes. */
  recommendation: "pass" | "fail" | "incomplete";
  /** Human-readable reasons an incomplete/failing card is not yet a PASS. */
  blockers: string[];
};

/** Roll the three axes up into a Pass/Fail recommendation. */
export function overallVerdict(scores: Scores): Verdict {
  const axes = REVIEW_AXES.map((a) => scoreAxis(a, scores));
  const [dna, material, family] = axes;
  const complete = axes.every((a) => a.complete);

  const totalWeight = REVIEW_AXES.reduce((s, a) => s + a.weight, 0);
  const overallPct = Math.round(
    axes.reduce((s, a, i) => s + a.pct * REVIEW_AXES[i].weight, 0) / totalWeight,
  );

  const blockers: string[] = [];
  for (let i = 0; i < axes.length; i++) {
    const a = axes[i];
    if (!a.complete) blockers.push(`${a.label}: not fully scored`);
    else if (a.criticalFail) blockers.push(`${a.label}: a critical criterion scored 0`);
    else if (a.pct < REVIEW_AXES[i].passPct) blockers.push(`${a.label}: ${a.pct}% < ${REVIEW_AXES[i].passPct}% required`);
  }

  const recommendation: Verdict["recommendation"] = !complete
    ? "incomplete"
    : axes.every((a) => a.pass)
      ? "pass"
      : "fail";

  return { axes, dna, material, family, overallPct, complete, recommendation, blockers };
}
