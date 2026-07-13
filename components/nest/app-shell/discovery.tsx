"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, Plus, Share2, Sparkles } from "lucide-react";
import { creatorLabel, type DiscoveryCreator, type DiscoveryItem } from "@/lib/nest-discovery";
import { NestPreview } from "@/components/nest/app-shell/nest-preview";
import { LikeButton } from "@/components/nest/social/like-button";
import { CommentButton } from "@/components/nest/social/comment-button";
import { FollowButton } from "@/components/nest/social/follow-button";

// M17.1 — reusable discovery UI shared by Home (immersive feed) and Explore (grid).
// Cozy + identity-first: every Nest leads with WHO lives there, shows the creator's real
// composed room, and exposes engagement affordances (UI only — no social backend yet).

// ── Avatar ────────────────────────────────────────────────────────────────────
export function CreatorAvatar({ creator, size = 24, tone = "ink" }: { creator: DiscoveryCreator; size?: number; tone?: "ink" | "light" }) {
  const initial = (creator.username ?? creator.displayName ?? "N").trim().charAt(0).toUpperCase();
  const light = tone === "light";
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-black ${light ? "bg-white text-terracotta ring-2 ring-white/40 shadow-[0_2px_8px_rgba(0,0,0,0.25)]" : "bg-terracotta text-parchment"}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initial}
    </span>
  );
}

// ── CreatorBadge (compact — grid cards / visitor) ─────────────────────────────
export function CreatorBadge({ creator, tone = "ink" }: { creator: DiscoveryCreator; tone?: "ink" | "light" }) {
  const label = creatorLabel(creator);
  const light = tone === "light";
  const inner = (
    <>
      <CreatorAvatar creator={creator} size={24} tone={tone} />
      <span className={`truncate text-xs font-bold ${light ? "text-white" : "text-ink/70"}`}>{label}</span>
    </>
  );
  const cls = "inline-flex max-w-full items-center gap-1.5";
  return creator.username
    ? <Link href={`/@${creator.username}`} className={`${cls} ${light ? "" : "hover:underline"}`}>{inner}</Link>
    : <span className={cls}>{inner}</span>;
}

// ── CreatorRow (feed — avatar opens profile · name · @username · Follow) ───────
export function CreatorRow({ creator }: { creator: DiscoveryCreator }) {
  const hasProfile = !!creator.username;
  const name = creator.displayName ?? (creator.username ? `@${creator.username}` : "A Nestudio creator");
  const identity = (
    <span className="flex min-w-0 items-center gap-2.5">
      <CreatorAvatar creator={creator} size={38} tone="light" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-black tracking-tight text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.4)]">{name}</span>
        {creator.username ? <span className="block truncate text-xs font-medium text-white/75">@{creator.username}</span> : null}
      </span>
    </span>
  );
  return (
    <div className="flex items-center justify-between gap-2">
      {hasProfile ? <Link href={`/@${creator.username}`} className="min-w-0">{identity}</Link> : identity}
      <FollowButton creatorId={creator.id} tone="light" compact />
    </div>
  );
}

// ── NestTags ──────────────────────────────────────────────────────────────────
export function NestTags({ tags, max = 3, tone = "ink" }: { tags: string[]; max?: number; tone?: "ink" | "light" }) {
  if (!tags.length) return null;
  const light = tone === "light";
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.slice(0, max).map((t) => (
        <span key={t} className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${light ? "bg-white/15 text-white/90 ring-1 ring-white/15 backdrop-blur-sm" : "bg-[#efe7cf] text-ink/55"}`}>#{t}</span>
      ))}
    </div>
  );
}

// ── EngagementBar (real likes + comments; share copies the link) ─────────────--
export function EngagementBar({ id, href, tone = "light" }: { id: string; href: string; tone?: "ink" | "light" }) {
  return (
    <div className={`flex items-center gap-4 ${tone === "light" ? "text-white" : "text-ink/70"}`}>
      <LikeButton nestId={id} tone={tone} />
      <CommentButton nestId={id} tone={tone} />
      <ShareButton href={href} tone={tone} />
    </div>
  );
}

export function ShareButton({ href, tone = "light", iconOnly = false }: { href: string; tone?: "ink" | "light"; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = typeof window !== "undefined" ? window.location.origin + href : href;
    try {
      if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1400); }
    } catch { /* dismissed */ }
  }
  return (
    <button onClick={share} aria-label="Share" className={`flex items-center gap-1.5 text-sm font-bold transition active:scale-95 ${tone === "light" ? "text-white" : "text-ink/70"}`}>
      <Share2 className="size-5" /> {iconOnly ? (copied ? "✓" : "") : copied ? "Copied!" : "Share"}
    </button>
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

// ── VisitHouseButton (M19 — the house is the entry point; the Nest is a room in it) ──
export function VisitHouseButton({ handle, tone = "ink", className = "" }: { handle: string; tone?: "ink" | "light"; className?: string }) {
  const light = tone === "light";
  return (
    <Link
      href={`/@${handle}`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-soft transition active:scale-95 ${
        light ? "bg-white/90 text-ink" : "bg-terracotta text-parchment"
      } ${className}`}
    >
      <Home className="size-4" /> Visit House
    </Link>
  );
}

// ── DiscoveryNestCard (grid / row — Explore) ─────────────────────────────────--
export function DiscoveryNestCard({ item, layout = "grid" }: { item: DiscoveryItem; layout?: "grid" | "row" }) {
  if (layout === "row") {
    return (
      <div className="flex gap-3 overflow-hidden rounded-2xl border border-timber/15 bg-white p-2 shadow-soft">
        <Link href={item.href} className="block h-24 w-20 shrink-0">
          <NestPreview doc={item.doc} rounded="rounded-xl" className="h-full w-full" />
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
    <div className="group overflow-hidden rounded-3xl border border-timber/15 bg-white shadow-soft transition active:scale-[0.99]">
      <Link href={item.href} className="relative block">
        <NestPreview doc={item.doc} className="aspect-[4/5] w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
        <SourceBadge source={item.source} />
      </Link>
      <div className="space-y-1.5 p-3">
        <Link href={item.href} className="block truncate text-[15px] font-black leading-tight text-ink hover:underline">{item.title}</Link>
        <CreatorBadge creator={item.creator} />
        <NestTags tags={item.tags} max={2} />
        {item.creator.username ? (
          <Link href={`/@${item.creator.username}`} className="inline-flex items-center gap-1 pt-0.5 text-[11px] font-bold text-terracotta hover:underline">
            <Home className="size-3" /> Visit house
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// ── DiscoveryFeed (immersive vertical feed — Home) ───────────────────────────--
export function DiscoveryFeed({ items }: { items: DiscoveryItem[] }) {
  // Show a shimmer while discovery settles so the empty state never flashes on load.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (items.length === 0 && !settled) return <FeedSkeleton />;

  if (items.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-timber/25 bg-white/60 p-10 text-center">
          <p className="display text-2xl">No Nests to wander yet</p>
          <p className="max-w-xs text-sm text-ink/50">Be the first — make a cozy place that feels like you.</p>
          <div className="mt-2 flex gap-2">
            <Link href="/create" className="rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">Create a Nest</Link>
            <Link href="/explore" className="rounded-xl border border-timber/20 bg-white px-5 py-3 text-sm font-bold text-ink/70">Explore examples</Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    // True vertical paging: one Nest per viewport, snap-mandatory, no peek of the next.
    // `scroll-smooth` + iOS momentum make swiping between Nests feel fluid.
    <div className="h-full snap-y snap-mandatory scroll-smooth overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none]">
      {items.map((item) => <FeedCard key={item.key} item={item} />)}
      <CreateCard />
    </div>
  );
}

// A single full-screen shimmer card so the feed loads gracefully (no blank flash).
function FeedSkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#e9e0c8]">
      <div className="nest-shimmer absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#241811]/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-3 p-5 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-full bg-white/40" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 rounded-full bg-white/40" />
            <div className="h-2.5 w-20 rounded-full bg-white/25" />
          </div>
        </div>
        <div className="h-6 w-2/3 rounded-lg bg-white/40" />
        <div className="flex gap-2">
          <div className="h-11 flex-1 rounded-2xl bg-white/40" />
          <div className="h-11 w-24 rounded-2xl bg-white/25" />
        </div>
      </div>
    </div>
  );
}

// Bottom padding that lifts feed controls clear of the translucent BottomNav, so the
// composed room can run full-bleed underneath it (no cream gap, Reels-style).
const NAV_CLEAR = "calc(4.75rem + env(safe-area-inset-bottom))";

function FeedCard({ item }: { item: DiscoveryItem }) {
  // The Nest is already visible in the feed, so the room itself is the primary tap
  // target (visit the Nest). The one explicit CTA is Visit House; engagement lives in a
  // light Reels-style rail. Kept minimal so the room breathes — no heavy dark block.
  return (
    <article className="relative h-full w-full snap-start snap-always overflow-hidden bg-[#e9e0c8]">
      {/* Full-bleed composed room — the Nest is the hero, edge to edge. Tapping visits it. */}
      <Link href={item.href} className="absolute inset-0" aria-label={`Visit ${item.title}`}>
        <NestPreview doc={item.doc} className="size-full" />
      </Link>

      {/* Lighting — legibility only, never a panel. A whisper at the top for the badge; at
          the bottom a single smooth fade (no mid plateau → no hard edge, no block). The room
          stays visible through it edge-to-edge; text rides on its own shadow. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/18 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/45 to-transparent" />

      <div className="pointer-events-none absolute left-4 top-4">
        <span className="pointer-events-auto"><SourceBadge source={item.source} floating /></span>
      </div>

      {/* Reels-style vertical action rail (like · comment · share), lifted above the nav. */}
      <div className="pointer-events-none absolute right-3 bottom-0" style={{ paddingBottom: NAV_CLEAR }}>
        <div className="pointer-events-auto flex flex-col items-center gap-4 pb-2 [&_button]:[text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
          <LikeButton nestId={item.id} tone="light" />
          <CommentButton nestId={item.id} tone="light" />
          <ShareButton href={item.href} tone="light" iconOnly />
        </div>
      </div>

      {/* Identity + title + one CTA, kept compact and clear of the nav + the rail. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-2.5 px-5 pr-16 pt-5" style={{ paddingBottom: NAV_CLEAR }}>
        <div className="pointer-events-auto"><CreatorRow creator={item.creator} /></div>
        <h2 className="display text-[21px] font-black leading-[1.12] tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.45)]">{item.title}</h2>
        {item.tags.length ? <div className="pointer-events-auto"><NestTags tags={item.tags} tone="light" max={2} /></div> : null}
        {item.creator.username ? (
          <div className="pointer-events-auto pt-0.5">
            <Link href={`/@${item.creator.username}`} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-black text-parchment shadow-lift transition active:scale-95">
              <Home className="size-4" /> Visit House
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CreateCard() {
  return (
    <article className="grid h-full w-full snap-start snap-always place-items-center bg-gradient-to-br from-[#f6e7c6] to-[#ecd9ad] p-6 text-center">
      <div>
        <div className="mb-1 flex items-center justify-center gap-1.5 text-terracotta"><Sparkles className="size-4" /><span className="text-xs font-black uppercase tracking-wider">Your turn</span></div>
        <p className="display text-3xl">Make a place that feels like you</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink/55">Who lives here? What does your Nest say about you?</p>
        <Link href="/create" className="mt-4 inline-flex items-center gap-1 rounded-xl bg-terracotta px-6 py-3 text-sm font-bold text-parchment"><Plus className="size-4" /> Create your Nest</Link>
      </div>
    </article>
  );
}

function SourceBadge({ source, floating }: { source: DiscoveryItem["source"]; floating?: boolean }) {
  const label = source === "published" ? "Live" : source === "curated" ? "Example" : "Demo";
  const base = "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider";
  if (floating) {
    const dot = source === "published" ? "bg-meadow-shade" : "bg-ink/35";
    return (
      <span className={`inline-flex items-center gap-1.5 ${base} bg-white/90 text-ink/70 shadow-soft ring-1 ring-black/5 backdrop-blur`}>
        <span className={`size-1.5 rounded-full ${dot}`} /> {label}
      </span>
    );
  }
  return <span className={`absolute left-2 top-2 ${base} bg-ink/80 text-parchment`}>{label}</span>;
}
