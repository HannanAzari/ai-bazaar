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

// Optional status colour for the corner badge. Omitted → the original neutral badge, so
// every existing caller (explore, discovery, public /@handle) renders exactly as before.
export type NestCardTone = "draft" | "public" | "unlisted" | "followers" | "private";
const TONE_CLASS: Record<NestCardTone, string> = {
  draft: "bg-white/85 text-ink ring-1 ring-inset ring-timber/20",
  public: "bg-[#4d7358] text-white",
  unlisted: "bg-[#5b7a99] text-white",
  followers: "bg-terracotta text-parchment",
  private: "bg-ink/85 text-parchment",
};

export function NestCard({
  doc,
  href,
  subtitle,
  badge,
  tone,
}: {
  doc: NestDocument;
  href: string;
  subtitle?: string;
  badge?: string;
  tone?: NestCardTone;
}) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-timber/15 bg-white shadow-soft transition active:scale-[0.98]"
    >
      <div className="relative">
        <NestPreview doc={doc} className="aspect-[4/5] w-full" />
        {badge ? (
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide shadow-sm ${tone ? TONE_CLASS[tone] : "bg-ink/80 text-parchment"}`}>
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
