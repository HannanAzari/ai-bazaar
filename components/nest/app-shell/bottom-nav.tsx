"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// The permanent mobile app shell nav (M15). Four cozy tabs — Home · Explore ·
// Create · Updates. Create is the emphasised centre action (the new creation
// entry point). Persisted across the app routes via NestAppChrome. Safe-area
// aware so it clears the iOS home indicator.

type Tab = { href: string; label: string; icon: typeof Home; accent?: boolean };

const TABS: Tab[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/create", label: "Create", icon: Plus, accent: true },
  { href: "/updates", label: "Updates", icon: Bell },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-timber/15 bg-parchment/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          if (tab.accent) {
            return (
              <li key={tab.href} className="flex flex-1 items-center justify-center">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  aria-current={active ? "page" : undefined}
                  className="flex flex-col items-center gap-1 pt-1.5"
                >
                  <span className="grid size-12 -translate-y-3 place-items-center rounded-full bg-terracotta text-parchment shadow-lift ring-4 ring-parchment transition active:scale-95">
                    <Icon size={24} strokeWidth={2.4} />
                  </span>
                  <span className="-mt-2 text-[10px] font-black text-terracotta">{tab.label}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.href} className="flex flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition",
                  active ? "text-ink" : "text-ink/45 hover:text-ink/70",
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.6 : 2} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
