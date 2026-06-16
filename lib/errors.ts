// Friendly, calm user-facing error messages for production paths. Raw Supabase /
// network errors are logged to the console for developers; users only ever see a
// short, reassuring sentence. Pure + tested (the mapping), with a console side
// effect for dev detail.

export type ErrorContext =
  | "signin"
  | "signup"
  | "onboarding"
  | "claim"
  | "save"
  | "load"
  | "upload"
  | "generic";

const CONTEXT_DEFAULT: Record<ErrorContext, string> = {
  signin: "We couldn't sign you in. Please try again.",
  signup: "We couldn't create your account. Please try again.",
  onboarding: "We couldn't finish setting up your room. Please try again.",
  claim: "We couldn't create your Nest. Please try again.",
  save: "We couldn't save your changes. Please try again.",
  load: "We couldn't load this just now. Please refresh and try again.",
  upload: "That image couldn't be uploaded. Please try a different file.",
  generic: "Something went wrong. Please try again.",
};

// Known Supabase / auth signals → calm copy. Matched loosely on message + code.
const PATTERNS: { test: RegExp; message: string }[] = [
  { test: /invalid login credentials/i, message: "That email or password doesn't match. Please try again." },
  { test: /email not confirmed/i, message: "Please confirm your email, then sign in." },
  { test: /user already registered|already registered|already exists/i, message: "An account with that email already exists — try signing in." },
  { test: /email address.*invalid|invalid.*email|email_address_invalid/i, message: "Please enter a valid email address." },
  { test: /password.*(short|least|6|weak)|weak_password/i, message: "Please choose a password with at least 6 characters." },
  { test: /rate limit|over_email_send_rate_limit|too many/i, message: "Too many attempts. Please wait a minute and try again." },
  { test: /no shop found|claim the house first/i, message: "We couldn't find your Nest. Please try creating it again." },
  { test: /all villages are full|villages are available/i, message: "All village spots are taken right now. Please try again later." },
  { test: /failed to fetch|networkerror|network request failed|fetch failed/i, message: "You appear to be offline. Check your connection and try again." },
];

function rawMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const maybe = err as { message?: unknown; error_description?: unknown; msg?: unknown };
  return String(maybe.message ?? maybe.error_description ?? maybe.msg ?? "");
}

/**
 * Map any thrown value to a short, calm user message. Logs the raw error to the
 * console (dev detail) and never returns a raw Supabase string.
 */
export function friendlyError(err: unknown, context: ErrorContext = "generic"): string {
  // Keep the real error available to developers.
  if (typeof console !== "undefined") console.error(`[${context}]`, err);
  const raw = rawMessage(err);
  for (const { test, message } of PATTERNS) {
    if (test.test(raw)) return message;
  }
  return CONTEXT_DEFAULT[context];
}
