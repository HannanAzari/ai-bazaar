"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, ChevronDown, Home, Scale, Wrench } from "lucide-react";

// Founder-only tools, tucked at the BOTTOM of the Profile behind a quiet disclosure so the
// page reads as the creator's own place, not an internal console. Visibility is decided by
// the SERVER (`/api/auth/whoami` → isFounder from the allowlist); routes are also server-gated
// (requireFounder). Collapsed by default. Avatar Studio is NOT here — it's a normal user feature.
export function NestudioStudio() {
  const [isFounder, setIsFounder] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/whoami").then((r) => r.json()).then((d) => { if (alive) setIsFounder(Boolean(d?.authenticated && d?.isFounder)); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!isFounder) return null;

  const tools: { href: string; label: string; icon: typeof Box }[] = [
    { href: "/asset-factory", label: "Create Asset", icon: Box },
    { href: "/nest-factory", label: "Create Empty Nest", icon: Home },
    { href: "/nest-studio/calibration", label: "Character Calibration", icon: Scale },
  ];

  return (
    <section className="rounded-2xl border border-timber/15 bg-white/60">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Wrench className="size-4 text-ink/40" />
        <span className="text-sm font-bold text-ink/70">Founder tools</span>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink/40">Founder</span>
        <ChevronDown className={`ml-auto size-4 text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="space-y-1.5 px-3 pb-3">
          {tools.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-timber/12 bg-white px-3 py-3 text-sm font-bold text-ink active:scale-[0.99]"
            >
              <Icon className="size-4 text-terracotta" /> {label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
