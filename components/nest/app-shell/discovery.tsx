"use client";

import Link from "next/link";
import { Heart, Plus, Sparkles } from "lucide-react";
import { creatorLabel, type DiscoveryCreator, type DiscoveryItem } from "@/lib/nest-discovery";

// M17 — reusable discovery UI shared by Home (immersive feed) and Explore (grid).
// Cozy + identity-first: every Nest leads with WHO lives there, not a metric.

// ── CreatorBadge ──────────────────────────────────────────────────────────────
export function CreatorBadge({ creator, tone = "ink" }: { creator: DiscoveryCreator; tone?: "ink" | "light" }) {
  const label = creatorLabel(creator);
  const initial = (creator.username ?? creator.displayName ?? "N").trim().charAt(0).toUpperCase();
  const light = tone === "light";
  const inner = (
    <>
      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-black ${light ? "bg-white/90 text-terracotta" : "bg-terracotta text-parchment"}`}>{initial}</span>
      <span className={`truncate text-xs font-bold ${light ? "text-white" : "text-ink/70"}`}>{label}</span>
    </>
  );
  const cls = "inline-flex max-w-full items-center gap-1.5";
  return creator.username
    ? <Link href={`/@${creator.username}`} className={`${cls} ${light ? "" : "hover:underline"}`}>{inner}</Link>
    : <span className={cls}>{inner}</span>;
}

// ── NestTags ──────────────────────────────────────────────────────────────────
export function NestTags({ tags, max = 3, tone = "ink" }: { tags: string[]; max?: number; tone?: "ink" | "light" }) {
  if (!tags.length) return null;
  const light = tone === "light";
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.slice(0, max).map((t) => (
        <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${light ? "bg-white/20 text-white backdrop-blur-sm" : "bg-[#efe7cf] text-ink/55"}`}>#{t}</span>
      ))}
    </div>
  );
}

// ── VisitNestButton ───────────────────────────────────────────────────────────
export function VisitNestButton({ href, className = "" }: { href: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-full bg-terracotta px-4 py-2 text-sm font-bold text-parchment shadow-soft transition active:scale-95 ${className}`}>
      Visit Nest →
    </Link>
  );
}

// ── DiscoveryNestCard (grid — Explore) ───────────────────────────────────────--
export function DiscoveryNestCard({ item, layout = "grid" }: { item: DiscoveryItem; layout?: "grid" | "row" }) {
  if (layout === "row") {
    return (
      <div className="flex gap-3 overflow-hidden rounded-2xl border border-timber/15 bg-white p-2 shadow-soft">
        <Link href={item.href} className="relative block h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#e9e0c8]">
          <Thumb src={item.thumbnail} alt={item.title} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <Link href={item.href} className="truncate text-sm font-black text-ink hover:underline">{item.title}</Link>
          <CreatorBadge creator={item.creator} />
          <NestTags tags={item.tags} max={2} />
        </div>
        <VisitNestButton href={item.href} className="self-center !px-3 !text-xs" />
      </div>
    );
  }
  return (
    <div className="group overflow-hidden rounded-2xl border border-timber/15 bg-white shadow-soft">
      <Link href={item.href} className="relative block aspect-[4/5] w-full bg-[#e9e0c8]">
        <Thumb src={item.thumbnail} alt={item.title} />
        <SourceBadge source={item.source} />
      </Link>
      <div className="space-y-1 p-2.5">
        <Link href={item.href} className="block truncate text-sm font-black text-ink hover:underline">{item.title}</Link>
        <CreatorBadge creator={item.creator} />
        <NestTags tags={item.tags} max={2} />
      </div>
    </div>
  );
}

// ── DiscoveryFeed (immersive vertical feed — Home) ───────────────────────────--
export function DiscoveryFeed({ items }: { items: DiscoveryItem[] }) {
  if (items.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-timber/25 bg-white/60 p-10 text-center">
        <p className="display text-2xl">No Nests to wander yet</p>
        <p className="max-w-xs text-sm text-ink/50">Be the first — make a cozy place that feels like you.</p>
        <div className="mt-2 flex gap-2">
          <Link href="/create" className="rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">Create a Nest</Link>
          <Link href="/explore" className="rounded-xl border border-timber/20 bg-white px-5 py-3 text-sm font-bold text-ink/70">Explore examples</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full snap-y snap-mandatory space-y-3 overflow-y-auto overscroll-contain pb-1 [scrollbar-width:none]">
      {items.map((item) => <FeedCard key={item.key} item={item} />)}
      <CreateCard />
    </div>
  );
}

function FeedCard({ item }: { item: DiscoveryItem }) {
  return (
    <article className="relative h-[90%] snap-start overflow-hidden rounded-[2rem] border border-timber/15 bg-[#e9e0c8] shadow-lift">
      {/* Full-bleed preview; tapping it visits the Nest. */}
      <Link href={item.href} className="absolute inset-0" aria-label={`Visit ${item.title}`}>
        <Thumb src={item.thumbnail} alt={item.title} />
      </Link>
      {/* Warm bottom gradient so overlay text stays legible (cozy, not TikTok-black). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#2a1c14]/85 via-[#2a1c14]/35 to-transparent" />

      <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between">
        <span className="pointer-events-auto"><SourceBadge source={item.source} floating /></span>
        <button disabled title="Saving arrives in a later sprint" aria-label="Save (coming soon)" className="pointer-events-auto grid size-9 cursor-not-allowed place-items-center rounded-full bg-white/85 text-ink/40 shadow-soft">
          <Heart className="size-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-2 p-4">
        <span className="pointer-events-auto inline-block"><CreatorBadge creator={item.creator} tone="light" /></span>
        <h2 className="text-2xl font-black leading-tight text-white drop-shadow-sm">{item.title}</h2>
        <div className="pointer-events-auto"><NestTags tags={item.tags} tone="light" /></div>
        <div className="pointer-events-auto flex items-center gap-2 pt-1">
          <VisitNestButton href={item.href} />
          <Link href="/create" className="rounded-full border border-white/40 px-4 py-2 text-sm font-bold text-white/90 backdrop-blur-sm transition active:scale-95">Create your own</Link>
        </div>
      </div>
    </article>
  );
}

function CreateCard() {
  return (
    <article className="grid h-[90%] snap-start place-items-center rounded-[2rem] border border-timber/15 bg-gradient-to-br from-[#f6e7c6] to-[#ecd9ad] p-6 text-center shadow-lift">
      <div>
        <div className="mb-1 flex items-center justify-center gap-1.5 text-terracotta"><Sparkles className="size-4" /><span className="text-xs font-black uppercase tracking-wider">Your turn</span></div>
        <p className="display text-3xl">Make a place that feels like you</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink/55">Who lives here? What does your Nest say about you?</p>
        <Link href="/create" className="mt-4 inline-flex items-center gap-1 rounded-xl bg-terracotta px-6 py-3 text-sm font-bold text-parchment"><Plus className="size-4" /> Create your Nest</Link>
      </div>
    </article>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────
function Thumb({ src, alt }: { src?: string; alt: string }) {
  if (!src) return <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>;
  // eslint-disable-next-line @next/next/no-img-element -- local curated art; next/image adds no value here
  return <img src={src} alt={alt} className="size-full object-cover" loading="lazy" />;
}

function SourceBadge({ source, floating }: { source: DiscoveryItem["source"]; floating?: boolean }) {
  const label = source === "published" ? "Live" : source === "curated" ? "Example" : "Demo";
  const base = "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide";
  if (floating) return <span className={`${base} bg-white/85 text-ink/70 shadow-soft`}>{label}</span>;
  return <span className={`absolute left-2 top-2 ${base} bg-ink/80 text-parchment`}>{label}</span>;
}
