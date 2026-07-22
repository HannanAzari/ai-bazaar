import type { FC } from "react";

// ── Generation Platform — the shared contract every generation module implements ─
//
// One engine (components/generation/generation-studio.tsx) owns everything common to
// Asset Factory, Nest Factory, and future modules (Avatar…): the founder gate, token
// handling, the input→interpret→spec→generate→review→approve→publish→saved stage
// machine, the re-entrancy guard, cost display, moderation gating, and library
// publishing orchestration. A module supplies only what differs: its translator, its
// generation engine, its spec/review/saved renderers, and its publish call.
//
// Success metric for the refactor: the modules contain NO duplicated shell logic.

export type UploadMode = "none" | "optional" | "required";

/** Founder/User ownership — the shared pipeline's ownership seam. Founder mode = global. */
export type Ownership = { scope: "global" | "private-user"; ownerId: string | null };
export const FOUNDER_OWNERSHIP: Ownership = { scope: "global", ownerId: null };

/** A module method result. `unauthorized` drives the founder gate uniformly. */
export type ModuleResult<T> = { ok: true; value: T } | { ok: false; error: string; unauthorized?: boolean };

export type PublishOutcome =
  | { ok: true; id: string; imageUrl: string; status: string }
  | { ok: false; error: string; unauthorized?: boolean };

export type SavedInfo = { name: string; id: string; imageDataUrl: string; published: boolean };

export type ModuleCopy = {
  headerTitle: string; // "Asset Factory"
  headerTagline: string;
  gateTitle: string; // "Creation Studio"
  gateSubtitle: string;
  gateButton: string; // "Enter Studio"
  inputPlaceholder: string;
  inputHint?: string;
  publishingLabel: string; // "Publishing to your Nestudio library…"
  approveLabel: string; // "Approve & Add" / "Approve & Publish"
  reviewQuestion: string; // "Would I proudly place this in a Nest?"
  detailsLabel?: string; // toggle caption; omit to hide the Details section
};

export interface GenerationModule<Spec, Result> {
  key: string;
  copy: ModuleCopy;
  uploadMode: UploadMode;

  // ── Translator ──
  translate(a: { description: string; hasReference: boolean; headers: Record<string, string> }): Promise<ModuleResult<Spec>>;
  estimatedCost(spec: Spec): number;
  moderationOk(spec: Spec): boolean;
  specName(spec: Spec): string;

  // ── Generation engine (the ONLY part that meaningfully differs per module) ──
  generate(a: { spec: Spec; upload: string | null; setProgress: (s: string) => void; headers: Record<string, string> }): Promise<ModuleResult<Result>>;
  resultImage(r: Result): string; // final data URL → publish + saved preview
  resultCost(r: Result): number | null;

  // ── Publishing (library-specific, shared safety) ──
  publish(a: { spec: Spec; result: Result; ownership: Ownership }): Promise<PublishOutcome>;
  /** Persist the module's local mirror (called after publish, success or failure). */
  onApproved?(a: { spec: Spec; result: Result; outcome: PublishOutcome; ownership: Ownership }): void;

  // ── Renderers (the type-specific screens) ──
  SpecView: FC<{ spec: Spec; onChange: (s: Spec) => void }>;
  ReviewView: FC<{ spec: Spec; result: Result }>;
  DetailsView?: FC<{ spec: Spec; result: Result }>;
  SavedView: FC<{ info: SavedInfo }>;
}
