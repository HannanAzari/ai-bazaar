"use client";

import Link from "next/link";
import { resolveBackground } from "@/lib/nest-production-library";
import type { NestDocument } from "@/lib/nest-document-types";

// A cozy Nest thumbnail card shared by Home · Explore · /@handle. The thumbnail is
// the doc's production background (the placements render on the real Nest page); this
// keeps the listings light and consistent without mounting the renderer per card.

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
  const src = nestThumb(doc);
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-timber/15 bg-white shadow-soft transition active:scale-[0.98]"
    >
      <div className="relative aspect-[4/5] w-full bg-[#e9e0c8]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- local curated art; next/image adds no value here
          <img src={src} alt={doc.title} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>
        )}
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
