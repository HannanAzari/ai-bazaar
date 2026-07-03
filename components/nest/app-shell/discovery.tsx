"use client";

import { useState } from "react";
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
    <span className={`grid shrink-0 place-items-center rounded-full font-black ${light ? "bg-white/90 text-terracotta" : "bg-terracotta text-parchment"}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
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
    <span className="flex min-w-0 items-center gap-2">
      <CreatorAvatar creator={creator} size={34} tone="light" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-black text-white drop-shadow-sm">{name}</span>
        {creator.username ? <span className="block truncate text-xs text-white/70">@{creator.username}</span> : null}
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
        <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${light ? "bg-white/20 text-white backdrop-blur-sm" : "bg-[#efe7cf] text-ink/55"}`}>#{t}</span>
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

export function ShareButton({ href, tone = "light" }: { href: string; tone?: "ink" | "light" }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = typeof window !== "undefined" ? window.location.origin + href : href;
    try {
      if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1400); }
    } catch { /* dismissed */ }
  }
  return (
    <button onClick={share} className={`flex items-center gap-1.5 text-sm font-bold transition active:scale-95 ${tone === "light" ? "text-white" : "text-ink/70"}`}>
      <Share2 className="size-5" /> {copied ? "Copied!" : "Share"}
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
    <div className="group overflow-hidden rounded-2xl border border-timber/15 bg-white shadow-soft">
      <Link href={item.href} className="relative block">
        <NestPreview doc={item.doc} className="aspect-[4/5] w-full" />
        <SourceBadge source={item.source} />
      </Link>
      <div className="space-y-1 p-2.5">
        <Link href={item.href} className="block truncate text-sm font-black text-ink hover:underline">{item.title}</Link>
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
    <div className="h-full snap-y snap-mandatory space-y-3 overflow-y-auto overscroll-contain pb-1 [scrollbar-width:none]">
      {items.map((item) => <FeedCard key={item.key} item={item} />)}
      <CreateCard />
    </div>
  );
}

function FeedCard({ item }: { item: DiscoveryItem }) {
  return (
    <article className="relative h-[94%] snap-start overflow-hidden rounded-[2rem] border border-timber/15 shadow-lift">
      {/* Full-bleed composed room; tapping it visits the Nest. */}
      <Link href={item.href} className="absolute inset-0" aria-label={`Visit ${item.title}`}>
        <NestPreview doc={item.doc} className="size-full" />
      </Link>
      {/* Warm bottom gradient so overlay text stays legible (cozy, not TikTok-black). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-[#2a1c14]/90 via-[#2a1c14]/40 to-transparent" />

      <div className="pointer-events-none absolute left-3 top-3">
        <span className="pointer-events-auto"><SourceBadge source={item.source} floating /></span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-2.5 p-4">
        <div className="pointer-events-auto"><CreatorRow creator={item.creator} /></div>
        <h2 className="text-2xl font-black leading-tight text-white drop-shadow-sm">{item.title}</h2>
        <div className="pointer-events-auto"><NestTags tags={item.tags} tone="light" /></div>
        <div className="pointer-events-auto"><EngagementBar id={item.id} href={item.href} /></div>
        <div className="pointer-events-auto flex items-center gap-2 pt-0.5">
          {item.creator.username ? (
            <>
              {/* The House is the entry point; the Nest is a room you peek into. */}
              <VisitHouseButton handle={item.creator.username} />
              <Link href={item.href} className="rounded-full border border-white/40 px-4 py-2 text-sm font-bold text-white/90 backdrop-blur-sm transition active:scale-95">Peek inside</Link>
            </>
          ) : (
            <>
              <VisitNestButton href={item.href} />
              <Link href="/create" className="rounded-full border border-white/40 px-4 py-2 text-sm font-bold text-white/90 backdrop-blur-sm transition active:scale-95">Create your own</Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function CreateCard() {
  return (
    <article className="grid h-[94%] snap-start place-items-center rounded-[2rem] border border-timber/15 bg-gradient-to-br from-[#f6e7c6] to-[#ecd9ad] p-6 text-center shadow-lift">
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
  const base = "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide";
  if (floating) return <span className={`${base} bg-white/85 text-ink/70 shadow-soft`}>{label}</span>;
  return <span className={`absolute left-2 top-2 ${base} bg-ink/80 text-parchment`}>{label}</span>;
}
