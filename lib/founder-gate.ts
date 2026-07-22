import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

// ── Server-only founder gate ─────────────────────────────────────────────────
//
// The SMALLEST safe gate that is enforced SERVER-SIDE (never a hidden URL): a
// shared secret in FOUNDER_ACCESS_TOKEN. The Creation Studio sends it as the
// `x-founder-token` header; every generation + global-publish route calls
// assertFounder() before doing anything expensive or persistent.
//
// Properties:
//   • Secret lives ONLY in FOUNDER_ACCESS_TOKEN (server env) — never NEXT_PUBLIC_.
//   • Fails CLOSED: if the server has no token configured, every gated route
//     refuses (503) — a misconfigured deploy can never be silently open.
//   • Constant-time compare (no length/So timing oracle).
//   • Not authentication of a *person* — a founder-only capability gate, which is
//     exactly what this sprint needs (no OAuth build). User auth (Supabase) stays
//     available for the future private-user ownership model.

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on length mismatch; hash to fixed length would be
  // ideal, but comparing a fixed-length digest is overkill here — pad-compare.
  if (ab.length !== bb.length) {
    // Still do a compare against self to burn similar time, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Returns a NextResponse to short-circuit with when the caller is NOT the founder,
 * or null when the request is authorised. Usage at the top of a route handler:
 *
 *   const gate = assertFounder(request);
 *   if (gate) return gate;
 */
export function assertFounder(request: Request): NextResponse | null {
  const expected = process.env.FOUNDER_ACCESS_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Founder access is not configured on the server.", configured: false },
      { status: 503 },
    );
  }
  const provided = request.headers.get("x-founder-token") ?? "";
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: "Founder access required.", authorized: false }, { status: 401 });
  }
  return null;
}
