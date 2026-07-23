"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Home, Sparkles } from "lucide-react";

// Founder-only Creation hub, shown on the Profile. Visibility is decided by the SERVER
// (`/api/auth/whoami` → isFounder, resolved from the FOUNDER_EMAILS/USER_IDS allowlist),
// so normal users never see it and it never requires a hidden URL. The routes themselves
// are also server-gated (requireFounder), so this is convenience navigation, not the gate.
export function CreatorLab() {
  const [isFounder, setIsFounder] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/whoami")
      .then((r) => r.json())
      .then((d) => { if (alive) setIsFounder(Boolean(d?.authenticated && d?.isFounder)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!isFounder) return null;

  return (
    <section className="rounded-3xl border border-terracotta/30 bg-gradient-to-br from-[#f6e7c6]/60 to-white p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-terracotta" />
        <h2 className="text-sm font-black text-ink">Creator Lab</h2>
        <span className="ml-auto rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] font-bold text-terracotta">Founder</span>
      </div>
      <p className="mt-1 text-xs text-ink/55">Build the official Nestudio library.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/asset-factory" className="flex items-center gap-2 rounded-2xl border border-timber/15 bg-white px-3 py-3 text-sm font-bold text-ink active:scale-95">
          <Box className="size-4 text-terracotta" /> Create Asset
        </Link>
        <Link href="/nest-factory" className="flex items-center gap-2 rounded-2xl border border-timber/15 bg-white px-3 py-3 text-sm font-bold text-ink active:scale-95">
          <Home className="size-4 text-teal" /> Create Empty Nest
        </Link>
      </div>
    </section>
  );
}
