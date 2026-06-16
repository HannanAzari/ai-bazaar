import { type NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, cookieGrantsAccess } from "@/lib/auth";

// Per-route auth guard for the API (V2). The page middleware redirects browsers to
// /login; API routes instead return a JSON 401 so fetch() can handle it. When no
// password is configured, cookieGrantsAccess() returns true and the API is open.
export function isAuthorized(req: NextRequest): boolean {
  return cookieGrantsAccess(req.cookies.get(AUTH_COOKIE)?.value);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Not authorized." }, { status: 401 });
}

export function serverError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Server error.";
  console.error("[asset-factory api]", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
