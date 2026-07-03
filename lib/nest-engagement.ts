// ── Count formatting ─────────────────────────────────────────────────────────
//
// (M18: the M17.1 placeholder like/follower generators were removed — engagement is
// now real, see lib/nest-social.ts. This keeps the shared compact-count formatter.)

/** Compact count formatting: 1200 → "1.2k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
}
