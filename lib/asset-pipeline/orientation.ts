/**
 * lib/asset-pipeline/orientation.ts — pose as GEOMETRY, not creativity.
 * -----------------------------------------------------------------------------
 * Phase 2, Sprint 2 (deterministic camera control). GPT Image chooses the camera
 * stochastically, so identical inputs came back at different horizontal rotations. You
 * cannot make the pose deterministic until you can MEASURE it — this module measures a
 * render's horizontal orientation from its own silhouette and validates it against a
 * fixed tolerance band. The canonical Nestudio camera is front-facing with only a slight
 * elevation, so a correct laptop/TV/sofa silhouette is close to LEFT-RIGHT SYMMETRIC; a
 * horizontal rotation into a three-quarter breaks that symmetry measurably.
 *
 * Pure geometry — operates on an alpha channel (Uint8ClampedArray). No DOM, no model,
 * no network. Usable in a route, a test, a script, or the browser (via alpha from a canvas).
 */

export type PoseMeasure = {
  /** 0..1 — fraction of the silhouette that matches its mirror about the vertical axis.
   *  1 = perfectly front-facing/symmetric; lower = more horizontal rotation. */
  symmetry: number;
  /** Signed left/right imbalance, -1..1 (positive = heavier on the right). */
  balance: number;
  /** Which side carries more mass (the direction of any rotation). */
  heavierSide: "left" | "right" | "balanced";
  /** Object bounding-box fill as a fraction of the frame. */
  coverage: number;
  /** Bounding box aspect (w/h). */
  aspect: number;
};

/**
 * The canonical pose tolerance — the "± degrees" made concrete. A symmetric object should
 * read ≥ minSymmetry; below that it has rotated into too strong a three-quarter. `balance`
 * catches a lopsided render even when overall symmetry looks acceptable.
 *
 * NOTE: this default suits horizontally SYMMETRIC objects (laptop, TV, sofa, shelf, frame,
 * plant). Intrinsically asymmetric objects (a camera with a side lens, a guitar) need their
 * own expected signature — see `expectedSymmetry` per object when we scale (documented).
 */
export const POSE_TOLERANCE = { minSymmetry: 0.86, maxBalance: 0.1 } as const;

/**
 * Measure horizontal pose from an alpha silhouette. Mirror the object's bounding box about
 * its centre column and score how much of it overlaps its reflection.
 */
export function measurePoseFromAlpha(
  alpha: Uint8ClampedArray,
  w: number,
  h: number,
  threshold = 40,
): PoseMeasure {
  let minx = w, maxx = -1, miny = h, maxy = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > threshold) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  if (maxx < 0) return { symmetry: 0, balance: 0, heavierSide: "balanced", coverage: 0, aspect: 0 };

  const bw = maxx - minx + 1, bh = maxy - miny + 1;
  const axis = (minx + maxx) / 2;
  let matched = 0, total = 0, left = 0, right = 0;
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      if (alpha[y * w + x] <= threshold) continue;
      total++;
      if (x < axis) left++; else if (x > axis) right++;
      const mx = Math.round(2 * axis - x);
      if (mx >= 0 && mx < w && alpha[y * w + mx] > threshold) matched++;
    }
  }
  const symmetry = total ? matched / total : 0;
  const balance = left + right ? (right - left) / (right + left) : 0;
  const heavierSide = Math.abs(balance) < 0.06 ? "balanced" : balance > 0 ? "right" : "left";
  return { symmetry, balance, heavierSide, coverage: (bw * bh) / (w * h), aspect: bw / bh };
}

export type PoseVerdict = { ok: boolean; symmetry: number; balance: number; reason: string };

/** Validate a measured pose against the tolerance band. */
export function validatePose(m: PoseMeasure, tol: { minSymmetry: number; maxBalance: number } = POSE_TOLERANCE): PoseVerdict {
  if (m.symmetry < tol.minSymmetry) {
    return { ok: false, symmetry: m.symmetry, balance: m.balance, reason: `rotated too far — symmetry ${m.symmetry.toFixed(3)} < ${tol.minSymmetry}` };
  }
  if (Math.abs(m.balance) > tol.maxBalance) {
    return { ok: false, symmetry: m.symmetry, balance: m.balance, reason: `lopsided — |balance| ${Math.abs(m.balance).toFixed(3)} > ${tol.maxBalance}` };
  }
  return { ok: true, symmetry: m.symmetry, balance: m.balance, reason: "within canonical pose tolerance" };
}
