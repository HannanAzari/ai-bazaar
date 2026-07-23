"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Home, Images, Layers, Scale, Sparkles } from "lucide-react";

// Founder-only "Nestudio Studio" hub on the Profile. Visibility is decided by the SERVER
// (`/api/auth/whoami` → isFounder from the allowlist), so normal users never see it and it
// never needs a hidden URL. The routes are also server-gated (requireFounder). Avatar Studio
// is NOT here — it lives in the normal user Profile.
export function NestudioStudio() {
  const [isFounder, setIsFounder] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/whoami").then((r) => r.json()).then((d) => { if (alive) setIsFounder(Boolean(d?.authenticated && d?.isFounder)); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!isFounder) return null;

  const active: { href: string; label: string; icon: typeof Box }[] = [
    { href: "/asset-factory", label: "Create Asset", icon: Box },
    { href: "/nest-factory", label: "Create Empty Nest", icon: Home },
    { href: "/nest-studio/calibration", label: "Character Calibration", icon: Scale },
  ];
  const soon: { label: string; icon: typeof Box }[] = [
    { label: "Official Asset Library", icon: Layers },
    { label: "Empty Nest Library", icon: Images },
    { label: "Generation History", icon: Sparkles },
  ];

  return (
    <section className="rounded-3xl border border-terracotta/30 bg-gradient-to-br from-[#f6e7c6]/60 to-white p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-terracotta" />
        <h2 className="text-sm font-black text-ink">Nestudio Studio</h2>
        <span className="ml-auto rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] font-bold text-terracotta">Founder</span>
      </div>
      <p className="mt-1 text-xs text-ink/55">Build the official Nestudio world.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {active.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-2 rounded-2xl border border-timber/15 bg-white px-3 py-3 text-sm font-bold text-ink active:scale-95">
            <Icon className="size-4 text-terracotta" /> {label}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {soon.map(({ label, icon: Icon }) => (
          <span key={label} className="inline-flex items-center gap-1 rounded-full bg-[#efe7cf] px-2 py-1 text-[10px] font-bold text-ink/45">
            <Icon className="size-3" /> {label} · soon
          </span>
        ))}
      </div>
    </section>
  );
}
