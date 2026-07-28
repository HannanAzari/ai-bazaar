// ── M23B §4 — one rule for "which version is the truth?" ─────────────────────
//
// Two stores existed and nothing reconciled them:
//
//   nestudio:nest-editor:v1:<docId>   the editor's autosave — the editor ALWAYS preferred it
//   the persisted NestDocument         what Profile cards, Home and visitors render
//
// So a creator could edit for an hour, see their new room in the editor, and see an old
// one on their own Profile. M23A made the geometry identical; it did not make the
// *versions* identical, which is why it still looked like a render bug.
//
// The rule, stated once and applied everywhere:
//
//   • AUTOSAVE protects in-progress work. It is a recovery buffer, never a source of truth.
//   • EXPLICIT SAVE writes the canonical draft, then clears the autosave — after Save, the
//     two stores cannot disagree because only one of them exists.
//   • PUBLISH writes the canonical published version, and likewise clears the autosave.
//
// On reopening, the canonical document wins UNLESS the autosave is strictly newer, which
// only happens when the creator left with unsaved changes. In that case we restore their
// work (losing it would be worse) and the caller tells them so — the divergence is
// surfaced, never silent.

export type ReconcileChoice = "canonical" | "autosave";

export type ReconcileResult = {
  choice: ReconcileChoice;
  /** True when unsaved in-progress work was restored — the caller should say so. */
  restoredUnsaved: boolean;
};

/**
 * Decide which version the editor should open, from the two `updatedAt` stamps.
 * Pure, so the rule is testable without a browser or a React tree.
 */
export function reconcileDraft(input: {
  canonicalUpdatedAt?: string;
  autosaveUpdatedAt?: string;
}): ReconcileResult {
  const { canonicalUpdatedAt, autosaveUpdatedAt } = input;

  // Nothing autosaved ⇒ nothing to reconcile.
  if (!autosaveUpdatedAt) return { choice: "canonical", restoredUnsaved: false };

  // Nothing canonical yet (a brand-new local draft) ⇒ the autosave is all there is.
  if (!canonicalUpdatedAt) return { choice: "autosave", restoredUnsaved: true };

  // Strictly newer, by ISO-8601 string order (lexicographic == chronological here).
  // Equal timestamps resolve to canonical: an autosave written in the same instant as a
  // Save is the same content, and preferring canonical keeps the stores converging.
  const autosaveIsNewer = autosaveUpdatedAt.localeCompare(canonicalUpdatedAt) > 0;
  return autosaveIsNewer
    ? { choice: "autosave", restoredUnsaved: true }
    : { choice: "canonical", restoredUnsaved: false };
}
