import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, cookieGrantsAccess } from "@/lib/auth";

// Gate every page behind the password when ASSET_FACTORY_PASSWORD is set. When it
// is unset, cookieGrantsAccess() returns true and the app runs open.
export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookieGrantsAccess(cookie)) {
    return NextResponse.next();
  }
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protect pages. API routes are excluded here and self-guard with isAuthorized()
  // so unauthenticated fetches get a JSON 401 instead of an HTML redirect.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|samples).*)"],
};
