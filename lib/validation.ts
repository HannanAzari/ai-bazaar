// Shared input limits + validators for pilot hardening. One source of truth so
// the UI, the demo libs, and the Supabase repos all agree (and match the DB CHECK
// constraints in supabase/schema.sql). Pure + tested.

export const LIMITS = {
  displayName: 80, // profiles.display_name (1..80)
  handle: 30, // profiles.username
  bio: 500, // profiles.bio (<=500)
  craft: 120, // onboarding "what do you create"
  roomName: 80, // rooms.name (1..80)
  roomDescription: 280,
  objectLabel: 80, // room_objects.label (<=80)
  guestbookNote: 500,
  socialUrl: 200,
} as const;

export type LimitKey = keyof typeof LIMITS;

/** Trim + hard-cap a string to a field's limit (never throws). */
export function clampText(value: string, key: LimitKey): string {
  return (value ?? "").slice(0, LIMITS[key]);
}

/** Generic length check against a field limit (after trim). */
export function withinLimit(value: string, key: LimitKey): boolean {
  return (value ?? "").trim().length <= LIMITS[key];
}

export type ValidationResult = { ok: boolean; value: string; error?: string };

/** Normalize + validate a public handle: lowercase, a–z 0–9 and dashes, 3..30. */
export function validateHandle(raw: string): ValidationResult {
  const value = (raw ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (value.length < 3) return { ok: false, value, error: "Handle must be at least 3 characters (letters, numbers, dashes)." };
  if (value.length > LIMITS.handle) return { ok: false, value: value.slice(0, LIMITS.handle), error: `Handle must be ${LIMITS.handle} characters or fewer.` };
  return { ok: true, value };
}

/** Email shape check (UI-level; the auth server is the real authority). */
export function isValidEmail(raw: string): boolean {
  const value = (raw ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Password floor (matches the 6-char minimum used across auth). */
export function isValidPassword(raw: string): boolean {
  return (raw ?? "").length >= 6;
}

/** A three-word village address, matching the shops.address CHECK in the schema. */
export function isValidAddress(address: string): boolean {
  return /^[a-z]+\.[a-z]+\.[a-z]+$/.test((address ?? "").trim());
}

/** A safe-ish URL for a social/link field (http(s) + length cap). */
export function isValidSocialUrl(raw: string): boolean {
  const value = (raw ?? "").trim();
  if (!value || value.length > LIMITS.socialUrl) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
