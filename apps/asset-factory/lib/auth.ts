// Simple internal access gate (Task 10). If ASSET_FACTORY_PASSWORD is set the app
// requires it (cookie checked in middleware); if unset the app runs open locally.
// This is intentionally lightweight — an internal tool for trusted reviewers, not
// public user auth. The password is never exposed to the client.

export const AUTH_COOKIE = "af_auth";

/** The configured gate password, or "" when the tool is open. Server-only. */
export function factoryPassword(): string {
  return process.env.ASSET_FACTORY_PASSWORD ?? "";
}

/** Whether a password gate is active. */
export function isGateEnabled(): boolean {
  return factoryPassword().length > 0;
}

/** Validate a submitted password against the configured one. */
export function checkPassword(submitted: string): boolean {
  const expected = factoryPassword();
  return expected.length > 0 && submitted === expected;
}

/** Whether a request's cookie value grants access. */
export function cookieGrantsAccess(cookieValue: string | undefined): boolean {
  if (!isGateEnabled()) return true;
  return cookieValue === factoryPassword();
}
