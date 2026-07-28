// ── HOTFIX M23B.1 — where a signed-in creator goes next ──────────────────────
//
// This decision lived in two places that disagreed with each other, and the disagreement
// was an infinite redirect loop:
//
//   /profile   redirected to /onboarding while the profile was still null
//   /onboarding redirected back to /profile once the profile FAILED to load
//
// so a signed-in user with an unreadable profile bounced between them forever, hammering
// the profile query (dozens of identical errors in the console) and keeping the auth lock
// saturated. One pure function now owns the rule, both screens call it, and it is unit
// tested — a loop needs two disagreeing opinions, and there is only one.
//
// The rule also distinguishes the three states that used to be conflated:
//   • still loading      → decide NOTHING (this is what caused the loop)
//   • failed to load     → do not route; the caller shows a recoverable error
//   • loaded, and empty  → onboarding step 1 (a missing profile is normal, not fatal)

import type { CreatorProfile } from "@/lib/nest/supabase-profile-repo";
import { nextOnboardingStep } from "@/lib/nest/supabase-profile-repo";

export type BootstrapState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: CreatorProfile | null };

export type RouteDecision =
  /** Send the user here. */
  | { kind: "navigate"; to: string }
  /** Render where we are; the caller shows a spinner or a recoverable error. */
  | { kind: "wait" }
  | { kind: "error"; message: string };

/** A `?next=` we are willing to honour: same-origin, path-only, no protocol-relative. */
export function safeReturnTo(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  // Never bounce straight back into an auth screen — that reads as "it didn't work".
  if (next.startsWith("/auth/")) return null;
  return next;
}

/**
 * Where to send a signed-in creator.
 *
 * `returnTo` is the interaction that triggered the sign-in (Like/Comment/Follow deep-link).
 * It is honoured only once onboarding requirements are satisfied — otherwise the creator
 * would land back on a Nest with no handle and no house, which is the state onboarding
 * exists to prevent. It is carried through onboarding as `?next=` so they get there in the end.
 */
export function postSignInRoute(state: BootstrapState, returnTo?: string | null): RouteDecision {
  if (state.status === "loading") return { kind: "wait" };
  if (state.status === "error") return { kind: "error", message: state.message };

  const safe = safeReturnTo(returnTo);
  const step = nextOnboardingStep(state.profile);

  if (step !== null) {
    // A missing profile row is the normal state for a brand-new account — route into
    // onboarding, never treat it as a fatal error.
    return { kind: "navigate", to: safe ? `/onboarding?next=${encodeURIComponent(safe)}` : "/onboarding" };
  }
  return { kind: "navigate", to: safe ?? "/profile" };
}

/**
 * Should THIS screen bounce the user to onboarding?
 *
 * Used by /profile. It answers `false` for both "still loading" and "failed to load" —
 * the two cases that previously produced the loop, because an absent profile and an
 * unreadable one were indistinguishable.
 */
export function shouldRedirectToOnboarding(state: BootstrapState): boolean {
  if (state.status !== "ready") return false;
  return nextOnboardingStep(state.profile) !== null;
}

/**
 * Should onboarding bounce the user OUT?
 *
 * Only when we positively know they are fully configured. While loading, or on error, the
 * answer is no — onboarding renders its own state rather than volleying the user back.
 */
export function shouldLeaveOnboarding(state: BootstrapState): boolean {
  if (state.status !== "ready") return false;
  return nextOnboardingStep(state.profile) === null;
}
