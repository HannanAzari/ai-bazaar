import { isFounder } from "@/lib/founder-role";
import type { ServerAuth } from "@/lib/auth/server-session";

// /moderation is founder-only. This reuses the SAME role mechanism as requireFounder /
// Nestudio Studio (getServerUser + isFounder allowlist) — no founder token, no new layer.
// It lives here (not exported from the page) because App Router page files may only export
// page fields (default, metadata, route config); exporting a helper from page.tsx fails the
// generated `.next/types` page-props constraint.
export function canViewModeration(auth: ServerAuth): boolean {
  return "user" in auth && isFounder(auth.user);
}
