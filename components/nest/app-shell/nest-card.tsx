"use client";

import Link from "next/link";
import { resolveBackground } from "@/lib/nest-production-library";
import { NestPreview } from "@/components/nest/app-shell/nest-preview";
import type { NestDocument } from "@/lib/nest-document-types";

// A cozy Nest card shared by Profile + /@handle. M17.1: the thumbnail renders the REAL
// composed Nest (background + the creator's placed furniture), not just the empty shell —
// so a card shows what they made.

/** Background-only image URL (kept for any light/fallback use). */
export function nestThumb(doc: NestDocument): string | undefined {
  const bg = resolveBackground(doc.backgroundId);
  return bg?.variants.mobile ?? bg?.variants.standard ?? bg?.imageUrl;
}

export function NestCard({
  doc,
  href,
  subtitle,
  badge,
}: {
  doc: NestDocument;
  href: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-timber/15 bg-white shadow-soft transition active:scale-[0.98]"
    >
      <div className="relative">
        <NestPreview doc={doc} className="aspect-[4/5] w-full" />
        {badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-parchment">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-black text-ink">{doc.title}</p>
        {subtitle ? <p className="truncate text-xs text-ink/45">{subtitle}</p> : null}
      </div>
    </Link>
  );
}
