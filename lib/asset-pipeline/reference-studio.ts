/**
 * lib/asset-pipeline/reference-studio.ts — the Reference Studio prompt (secondary pipeline).
 * -----------------------------------------------------------------------------
 * Phase 2, Sprint 2. The Asset Factory is photo-in, and clean per-object photos don't
 * exist at scale. Instead of sourcing random photographs, the Reference Studio GENERATES
 * studio-quality reference images (text-to-image) with an IDENTICAL visual language for
 * every object — same camera, lighting, background, framing, resolution. Those references
 * then feed the frozen Asset Factory:
 *
 *   Reference Generation → studio reference → Asset Generation → Cleanup → Calibration → Production
 *
 * The reference library becomes a reusable, Nestudio-owned asset. Only a reference the eye
 * rejects gets swapped for a manually sourced or official product photo.
 *
 * The camera is deliberately STRAIGHT-ON and symmetric — a front-facing reference feeds the
 * asset pipeline's pose determinism (high input-fidelity preserves this canonical pose).
 *
 * PURE DATA — no DOM, no SDK. Usable in a route, a test, a script or the client.
 */

export const REFERENCE_STUDIO_VERSION = "ref-studio@1";

/** The reference library's fixed output resolution (square). */
export const REFERENCE_SIZE = 1024;

/* ── the IDENTICAL visual language (every reference shares these, verbatim) ─────── */

const FRAMING =
  "FRAMING: one object only, centred and fully visible, filling about 65 percent of a square 1:1 frame with generous even margins; nothing cropped, nothing touching an edge.";

const CAMERA =
  "CAMERA (identical for every reference): a straight-on FRONT view from slightly above — about a 10 degree downward tilt, roughly 50mm, no wide-angle distortion. The object faces the camera squarely and reads LEFT-RIGHT SYMMETRIC; never rotated to a side or a strong three-quarter.";

const BACKGROUND =
  "BACKGROUND: a seamless, perfectly plain pure-white studio sweep — completely empty, no surface line, no props, no other objects, no hands, no text, no logo watermark.";

const LIGHTING =
  "LIGHTING: soft, even, neutral studio lighting with a gentle key from the upper-left and soft fill; neutral white balance, true colours, crisp focus, high detail; no harsh shadows, no coloured gels, no reflections thrown onto the background.";

const STYLE =
  "STYLE: a clean, realistic catalogue PRODUCT PHOTOGRAPH — a faithful, accurate reference of the real object. Not an illustration, not stylised, not a 3D-render art piece, not a toy.";

// Beta brand policy — clearly recognisable by category, but never a specific real product.
const BRAND_NEUTRAL =
  "BRAND-NEUTRAL: a generic, UNBRANDED design — clearly recognisable as its category but carrying NO logos, brand marks, trademarks, model names or written text; NO signature brand colourways and NO distinctive proprietary or patented industrial-design details. Do NOT copy or closely imitate any specific real-world product (no MacBook, no DualSense, no Canon/Sony, no Switch, no Nike, etc.). Invent a clean, neutral, original design of the category.";

/**
 * Build the studio reference prompt for one object. Only the subject varies — every other
 * clause is identical, which is what guarantees a consistent reference visual language.
 */
export function buildReferencePrompt(subject: string): string {
  const s = (subject || "object").trim();
  return [
    `A single ${s}, professional studio product photograph on a white background.`,
    FRAMING,
    CAMERA,
    BACKGROUND,
    LIGHTING,
    STYLE,
    BRAND_NEUTRAL,
    `The object is a ${s}, shown accurately and in full.`,
  ].join("\n");
}
