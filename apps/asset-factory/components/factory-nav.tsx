"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const TABS = [
  { href: "/", label: "Review" },
  { href: "/packs", label: "Packs" },
  { href: "/generate", label: "Generate" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/reports", label: "Reports" },
];

export function FactoryNav() {
  const pathname = usePathname();
  return (
    <div className="chips" style={{ marginBottom: 14 }}>
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={`chip ${active ? "active" : ""}`}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
