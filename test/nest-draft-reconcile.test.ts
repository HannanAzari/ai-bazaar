import { describe, expect, it } from "vitest";
import { reconcileDraft } from "@/lib/nest-draft-reconcile";

// M23B §4 — the rule that ends "the editor shows one version, my Profile shows another".
describe("reconcileDraft", () => {
  it("uses the canonical document when there is no autosave", () => {
    expect(reconcileDraft({ canonicalUpdatedAt: "2026-07-28T10:00:00.000Z" })).toEqual({
      choice: "canonical",
      restoredUnsaved: false,
    });
  });

  it("uses the autosave when there is no canonical document yet", () => {
    // A brand-new local draft that has never been saved through the repo.
    expect(reconcileDraft({ autosaveUpdatedAt: "2026-07-28T10:00:00.000Z" })).toEqual({
      choice: "autosave",
      restoredUnsaved: true,
    });
  });

  it("prefers the canonical document when it is newer (the post-Save case)", () => {
    // Save writes canonical AND clears the autosave, but a stale autosave from another
    // tab must never win over an explicit Save.
    expect(
      reconcileDraft({
        canonicalUpdatedAt: "2026-07-28T12:00:00.000Z",
        autosaveUpdatedAt: "2026-07-28T10:00:00.000Z",
      }),
    ).toEqual({ choice: "canonical", restoredUnsaved: false });
  });

  it("restores the autosave when it is strictly newer (unsaved in-progress work)", () => {
    expect(
      reconcileDraft({
        canonicalUpdatedAt: "2026-07-28T10:00:00.000Z",
        autosaveUpdatedAt: "2026-07-28T12:00:00.000Z",
      }),
    ).toEqual({ choice: "autosave", restoredUnsaved: true });
  });

  it("prefers canonical on an exact tie, so the two stores converge", () => {
    const t = "2026-07-28T10:00:00.000Z";
    expect(reconcileDraft({ canonicalUpdatedAt: t, autosaveUpdatedAt: t })).toEqual({
      choice: "canonical",
      restoredUnsaved: false,
    });
  });

  it("never reports restoredUnsaved when it chose canonical", () => {
    const cases = [
      { canonicalUpdatedAt: "2026-01-01T00:00:00.000Z" },
      { canonicalUpdatedAt: "2026-02-01T00:00:00.000Z", autosaveUpdatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    for (const c of cases) {
      const r = reconcileDraft(c);
      expect(r.choice).toBe("canonical");
      expect(r.restoredUnsaved).toBe(false);
    }
  });
});
