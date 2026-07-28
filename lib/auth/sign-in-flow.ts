// ── HOTFIX M23B.1 — the sign-in flow, as one testable unit ───────────────────
//
// The freeze lived in an `async` handler inside a React component, which is exactly where
// bugs like it hide: there is no way to assert "the loading state was reset" without a
// DOM. So the flow moved here — dependencies injected, no React, no Supabase — and the
// page became a thin renderer over it.
//
// The contract this guarantees, and that the tests pin down:
//
//   • `onBusy(true)` is emitted exactly once at the start
//   • `onBusy(false)` is ALWAYS emitted at the end — success, failure, throw, timeout,
//     or a router that blows up. It never depends on navigation happening.
//   • at most one authentication request is in flight at a time
//   • an authentication failure and a bootstrap failure are DIFFERENT outcomes, so a
//     missing table is never reported as a wrong password

import { postSignInRoute, safeReturnTo, type BootstrapState } from "@/lib/auth/post-sign-in-route";

export type SignInFlowResult =
  /** Credentials rejected — belongs on the password field. */
  | { kind: "auth-error"; message: string }
  /** Signed in, profile loaded, navigation requested. */
  | { kind: "navigated"; to: string }
  /** Signed in, but bootstrap failed. Session is valid; offer Retry. */
  | { kind: "bootstrap-error"; message: string }
  /** Something threw. Shown to the user, logged for developers. */
  | { kind: "unexpected-error"; message: string }
  /** A duplicate submission was rejected while one was already in flight. */
  | { kind: "ignored-duplicate" };

export type SignInDeps = {
  /** Authenticate, then bootstrap. Resolves with both outcomes. */
  signIn: (email: string, password: string) => Promise<
    { ok: true; bootstrap: BootstrapState } | { ok: false; error: string }
  >;
  navigate: (to: string) => void;
  onBusy: (busy: boolean) => void;
  /** Where the sign-in was triggered from (a Like/Comment deep-link). */
  returnTo?: string | null;
  /** Injected so a test can assert we log rather than swallow. */
  log?: (message: string, error: unknown) => void;
};

/** Tracks the in-flight request. A module-level guard would leak between components. */
export function createSignInFlow() {
  let inFlight = false;

  return {
    get isInFlight() {
      return inFlight;
    },

    async submit(email: string, password: string, deps: SignInDeps): Promise<SignInFlowResult> {
      // Duplicate submission: a held Enter key, a double-tap, or a re-render that has not
      // flushed the disabled state yet. One auth request, always.
      if (inFlight) return { kind: "ignored-duplicate" };
      inFlight = true;
      deps.onBusy(true);

      try {
        const r = await deps.signIn(email, password);
        if (!r.ok) return { kind: "auth-error", message: r.error };

        const decision = postSignInRoute(r.bootstrap, safeReturnTo(deps.returnTo));
        if (decision.kind === "navigate") {
          deps.navigate(decision.to);
          return { kind: "navigated", to: decision.to };
        }
        // Authenticated but not bootstrapped. The session stays valid — we do not sign
        // them out, and we do not claim the credentials were wrong.
        return {
          kind: "bootstrap-error",
          message: decision.kind === "error" ? decision.message : "Your profile is still loading.",
        };
      } catch (e) {
        (deps.log ?? ((m, err) => console.error(m, err)))("[login] sign-in failed:", e);
        return {
          kind: "unexpected-error",
          message: e instanceof Error ? e.message : "Something went wrong signing you in. Please try again.",
        };
      } finally {
        // The single most important line in the hotfix. Reached on every path above,
        // including a `navigate` that throws.
        deps.onBusy(false);
        inFlight = false;
      }
    },

    /** Retry bootstrap only — the session is already valid, so we never re-authenticate. */
    async retry(
      bootstrap: () => Promise<BootstrapState>,
      deps: Pick<SignInDeps, "navigate" | "onBusy" | "returnTo" | "log">,
    ): Promise<SignInFlowResult> {
      if (inFlight) return { kind: "ignored-duplicate" };
      inFlight = true;
      deps.onBusy(true);
      try {
        const state = await bootstrap();
        const decision = postSignInRoute(state, safeReturnTo(deps.returnTo));
        if (decision.kind === "navigate") {
          deps.navigate(decision.to);
          return { kind: "navigated", to: decision.to };
        }
        return {
          kind: "bootstrap-error",
          message: decision.kind === "error" ? decision.message : "Your profile is still loading.",
        };
      } catch (e) {
        (deps.log ?? ((m, err) => console.error(m, err)))("[login] bootstrap retry failed:", e);
        return {
          kind: "bootstrap-error",
          message: e instanceof Error ? e.message : "We still couldn’t load your profile.",
        };
      } finally {
        deps.onBusy(false);
        inFlight = false;
      }
    },
  };
}

export type SignInFlow = ReturnType<typeof createSignInFlow>;
