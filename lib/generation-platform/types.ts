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

/** A module method result. `unauthorized` (401) → sign-in redirect; `forbidden` (403) → role message. */
export type ModuleResult<T> = { ok: true; value: T } | { ok: false; error: string; unauthorized?: boolean; forbidden?: boolean };

export type PublishOutcome =
  | { ok: true; id: string; imageUrl: string; status: string }
  | { ok: false; error: string; unauthorized?: boolean; forbidden?: boolean };

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
  reviewQuestion: string; // single approval question (Asset/Nest)
  /** Multiple approval questions — ALL must be Yes to approve (Asset/Nest). Overrides reviewQuestion. */
  reviewQuestions?: string[];
  /** When true, review questions are OPTIONAL feedback and Approve is always enabled (Avatar). */
  optionalReview?: boolean;
  regenerateLabel?: string; // sticky-bar "Regenerate" override (e.g. "Try again")
  editLabel?: string; // sticky-bar "Edit" override (e.g. "Adjust style")
  interpretLabel?: string; // input-stage primary override (Avatar: "Continue"); default "Interpret →"
  generateLabel?: string; // spec-stage primary override (Avatar: "Create Avatar"); default hides cost when set
  detailsLabel?: string; // toggle caption; omit to hide the Details section
  /** Fallback route for the header back button (Avatar→/profile, Asset→/nest-editor, Nest→/create). */
  backHref: string;
};

export interface GenerationModule<Spec, Result> {
  key: string;
  copy: ModuleCopy;
  uploadMode: UploadMode;
  /**
   * Who may use this module:
   *  - "founder" (default): the founder-token gate screen; token rides every call.
   *  - "user": the authenticated end-user (real Supabase session, server-enforced by the
   *    routes). No founder gate screen; a 401 surfaces a "sign in" message instead.
   */
  authMode?: "founder" | "user";

  // ── Translator ── (`upload` present for image-first modules like Avatar)
  translate(a: { description: string; upload: string | null; hasReference: boolean; headers: Record<string, string> }): Promise<ModuleResult<Spec>>;
  estimatedCost(spec: Spec): number;
  moderationOk(spec: Spec): boolean;
  specName(spec: Spec): string;

  // ── Generation engine (the ONLY part that meaningfully differs per module) ──
  generate(a: { spec: Spec; upload: string | null; setProgress: (s: string) => void; headers: Record<string, string> }): Promise<ModuleResult<Result>>;
  resultImage(r: Result): string; // final data URL → publish + saved preview
  resultCost(r: Result): number | null;

  // ── Publishing (library-specific, shared safety) ── (`upload` = the source, for Avatar)
  publish(a: { spec: Spec; result: Result; upload: string | null; ownership: Ownership }): Promise<PublishOutcome>;
  /** Persist the module's local mirror (called after publish, success or failure). */
  onApproved?(a: { spec: Spec; result: Result; outcome: PublishOutcome; ownership: Ownership }): void;

  // ── Renderers (the type-specific screens) ──
  /** Optional extra content in the INPUT stage (e.g. Avatar consent). Interpret is
   *  blocked until onReadyChange(true) is called. */
  InputExtra?: FC<{ onReadyChange: (ready: boolean) => void }>;
  SpecView: FC<{ spec: Spec; onChange: (s: Spec) => void }>;
  ReviewView: FC<{ spec: Spec; result: Result; upload: string | null }>;
  DetailsView?: FC<{ spec: Spec; result: Result; upload: string | null }>;
  SavedView: FC<{ info: SavedInfo }>;
}
