"use client";
import { z } from "@/lib/nest-layers";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { onNotificationsChanged, unreadCount } from "@/lib/nest-notifications-store";

// The permanent mobile app shell nav (M15.1). Five cozy tabs, **icons only** —
// Home (discovery) · Explore (search) · Create · Notifications · Profile (dashboard).
// Create is the emphasised centre action. Labels live in aria-label for a11y; the bar
// stays quiet + warm (not a generic social tab bar). Safe-area aware.

type Tab = { href: string; label: string; icon: typeof Home; accent?: boolean };

const TABS: Tab[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/create", label: "Create", icon: Plus, accent: true },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const { ownerId } = useNestIdentity();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!ownerId) { setUnread(0); return; }
    const refresh = () => setUnread(unreadCount(ownerId));
    refresh();
    return onNotificationsChanged(refresh);
  }, [ownerId]);

  return (
    <nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 ${z.nav} border-t border-timber/15 bg-parchment/90 backdrop-blur-xl`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          if (tab.accent) {
            return (
              <li key={tab.href} className="flex flex-1 items-center justify-center">
                <Link href={tab.href} aria-label={tab.label} aria-current={active ? "page" : undefined} className="py-1.5">
                  {/* Active on /create: darker fill, elevated + glow, so the tab reads as "you are here". */}
                  <span
                    className={cn(
                      "grid size-12 -translate-y-3 place-items-center rounded-full text-parchment ring-4 ring-parchment transition active:scale-95",
                      active
                        ? "-translate-y-4 scale-105 bg-ink shadow-[0_0_0_4px_rgba(199,110,74,0.35),0_10px_24px_-6px_rgba(0,0,0,0.4)]"
                        : "bg-terracotta shadow-lift",
                    )}
                  >
                    <Icon size={24} strokeWidth={2.4} />
                  </span>
                </Link>
              </li>
            );
          }
          const showBadge = tab.href === "/notifications" && unread > 0;
          return (
            <li key={tab.href} className="flex flex-1">
              <Link
                href={tab.href}
                aria-label={showBadge ? `${tab.label} (${unread} unread)` : tab.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 items-center justify-center py-2 transition",
                  active ? "text-ink" : "text-ink/40 hover:text-ink/70",
                )}
              >
                <span className="relative">
                  <Icon size={24} strokeWidth={active ? 2.6 : 2} />
                  {showBadge ? (
                    <span className="absolute -right-1.5 -top-1 grid min-w-4 place-items-center rounded-full bg-terracotta px-1 text-[9px] font-black leading-4 text-parchment ring-2 ring-parchment">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
