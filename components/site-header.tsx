"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, UserRound, WandSparkles } from "lucide-react";
import { useDemo } from "@/components/providers/demo-provider";
import { NotificationBell } from "@/components/notification-bell";
import { Button, ButtonLink } from "@/components/ui/button";
import { flags } from "@/lib/flags";

// M15: the new Nestudio app shell (Home · Explore · Create · Updates · /@handle)
// and the full-screen editor own their own chrome, so the V1 village header steps
// out of the way there.
const NEST_APP_PREFIXES = ["/home", "/explore", "/create", "/updates", "/nest-editor", "/nest/", "/@", "/profile/"];

export function SiteHeader() {
  const { user, ownedShop, logout } = useDemo();
  const pathname = usePathname() ?? "";
  if (NEST_APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-timber/15 bg-parchment/85 backdrop-blur-xl">
      <div className="shell flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-terracotta text-parchment shadow-soft">
            <Home size={16} />
          </span>
          <span className="display text-lg">AI Bazaar</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/discover" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold hover:bg-white/70">
            <Compass size={17} />
            <span className="hidden sm:inline">Explore</span>
          </Link>
          {ownedShop && (
            <Link href="/home" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold hover:bg-white/70">
              <WandSparkles size={17} />
              <span className="hidden sm:inline">My place</span>
            </Link>
          )}
          {flags.notifications && <NotificationBell />}
          {user ? (
            <Button variant="ghost" className="size-10 px-0" onClick={logout} aria-label="Log out">
              <UserRound size={18} />
            </Button>
          ) : (
            <ButtonLink href="/auth/login" variant="outline" className="min-h-9 px-4">
              Log in
            </ButtonLink>
          )}
        </nav>
      </div>
    </header>
  );
}
