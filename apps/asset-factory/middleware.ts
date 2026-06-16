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
  // Protect everything except the login page, the login API, and static assets.
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico|samples).*)"],
};
