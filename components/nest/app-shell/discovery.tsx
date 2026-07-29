"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, Plus, Share2, Sparkles } from "lucide-react";
import { creatorLabel, type DiscoveryCreator, type DiscoveryItem } from "@/lib/nest-discovery";
import { NestPreview } from "@/components/nest/app-shell/nest-preview";
import { LikeButton } from "@/components/nest/social/like-button";
import { CommentButton } from "@/components/nest/social/comment-button";
import { FollowButton } from "@/components/nest/social/follow-button";
import { BOTTOM_NAV_CLEARANCE, z } from "@/lib/nest-layers";

// M17.1 → M23B — reusable discovery UI shared by Home (immersive feed) and Explore (grid).
// Cozy + identity-first: every Nest leads with WHO lives there and shows the creator's
// real composed room. The engagement affordances are no longer UI-only — Like, Comment
// and Share all persist to the shared tables now.

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
export function EngagementBar({
  id,
  href,
  tone = "light",
  ownerId,
  nestTitle,
}: {
  id: string;
  href: string;
  tone?: "ink" | "light";
  /** The Nest's owner — so a like/comment can notify the right creator. */
  ownerId?: string;
  nestTitle?: string;
}) {
  return (
    <div className={`flex items-center gap-4 ${tone === "light" ? "text-white" : "text-ink/70"}`}>
      <LikeButton nestId={id} tone={tone} ownerId={ownerId} nestTitle={nestTitle} />
      <CommentButton nestId={id} tone={tone} ownerId={ownerId} nestTitle={nestTitle} />
      <ShareButton href={href} tone={tone} />
    </div>
  );
}

// M23B §7 — Share.
//
// Native Web Share where the platform offers it, clipboard copy everywhere else, and a
// confirmation toast either way so the tap always has an answer. The URL shared is
// whatever `href` is — which, since M23B, is the payload-free `/nest/<slug>`, so the
// link opens the real Nest for anyone, in any browser, signed out.
//
// A share sheet the user dismisses is not a failure and shows no toast; a clipboard that
// genuinely refuses (insecure context, permission denied) says so instead of silently
// doing nothing.
export function ShareButton({ href, tone = "light", iconOnly = false }: { href: string; tone?: "ink" | "light"; iconOnly?: boolean }) {
  const [toast, setToast] = useState<"copied" | "failed" | null>(null);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.origin + href : href;
    const flash = (kind: "copied" | "failed") => { setToast(kind); setTimeout(() => setToast(null), 1800); };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url });
        return; // the OS sheet is its own confirmation
      } catch (e) {
        // AbortError = the user dismissed the sheet; anything else falls back to copy.
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("copied");
    } catch {
      flash("failed");
    }
  }

  return (
    <button
      onClick={share}
      aria-label="Share"
      className={`relative flex items-center gap-1.5 text-sm font-bold transition active:scale-95 ${tone === "light" ? "text-white" : "text-ink/70"}`}
    >
      <Share2 className="size-5" /> {iconOnly ? null : "Share"}
      {toast ? (
        <span
          role="status"
          className={`pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black text-white shadow-lift ${z.toast} ${toast === "copied" ? "bg-ink/85" : "bg-rose-600"}`}
        >
          {toast === "copied" ? "Link copied" : "Couldn’t copy"}
        </span>
      ) : null}
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
// The feed runs full-bleed under the translucent nav, so every card lifts its own
// controls clear of it. One constant, shared with every other bottom-anchored surface.
const NAV_CLEAR = BOTTOM_NAV_CLEARANCE;

function FeedCard({ item }: { item: DiscoveryItem }) {
  // The Nest is already visible in the feed, so the room itself is the primary tap
  // target (visit the Nest). The one explicit CTA is Visit House; engagement lives in a
  // light Reels-style rail. Kept minimal so the room breathes — no heavy dark block.
  return (
    <article className="relative h-full w-full snap-start snap-always overflow-hidden bg-[#e9e0c8]">
      {/* Full-bleed composed room — the Nest is the hero, edge to edge. Tapping visits it. */}
      <Link href={item.href} className={`absolute inset-0 ${z.room}`} aria-label={`Visit ${item.title}`}>
        <NestPreview doc={item.doc} className="size-full" surround />
      </Link>

      {/* Lighting — legibility only, never a panel. A whisper at the top for the badge; at
          the bottom a single smooth fade (no mid plateau → no hard edge, no block). The room
          stays visible through it edge-to-edge; text rides on its own shadow. */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/18 to-transparent ${z.scrim}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/45 to-transparent ${z.scrim}`} />

      {/* ── M24 §6 · TOP — identity left, Follow right ────────────────────────
          Creator metadata used to sit at the BOTTOM, stacked above the tags and the
          Visit House button, all competing for the same corner while the Follow pill
          crowded the avatar. Identity now owns the top of the card and the actions own
          the bottom, so nothing collides and the room keeps the middle. */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-4 ${z.chrome}`}>
        <div className="pointer-events-auto flex min-w-0 items-start gap-2.5">
          {item.creator.username ? (
            <Link href={`/@${item.creator.username}`} className="shrink-0">
              <CreatorAvatar creator={item.creator} size={38} tone="light" />
            </Link>
          ) : (
            <CreatorAvatar creator={item.creator} size={38} tone="light" />
          )}
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-black tracking-tight text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.45)]">
              {item.creator.displayName ?? (item.creator.username ? `@${item.creator.username}` : "A Nestudio creator")}
            </span>
            {item.creator.username ? (
              <span className="block truncate text-xs font-medium text-white/75">@{item.creator.username}</span>
            ) : null}
            {item.tags.length ? <span className="mt-1 block"><NestTags tags={item.tags} tone="light" max={2} /></span> : null}
          </span>
        </div>
        {/* Owner sees no Follow — you cannot follow yourself, and the owner's controls
            live in the Nest's own menu, never overlaid on the artwork. */}
        <div className="pointer-events-auto shrink-0">
          <FollowButton creatorId={item.creator.id} tone="light" compact />
        </div>
      </div>

      <div className={`pointer-events-none absolute left-4 top-[4.75rem] ${z.chrome}`}>
        <span className="pointer-events-auto"><SourceBadge source={item.source} floating /></span>
      </div>

      {/* Reels-style vertical action rail (like · comment · share), lifted above the nav. */}
      <div className={`pointer-events-none absolute right-3 bottom-0 ${z.chrome}`} style={{ paddingBottom: NAV_CLEAR }}>
        <div className="pointer-events-auto flex flex-col items-center gap-4 pb-2 [&_button]:[text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
          <LikeButton nestId={item.id} tone="light" ownerId={item.creator.id} nestTitle={item.title} />
          <CommentButton nestId={item.id} tone="light" ownerId={item.creator.id} nestTitle={item.title} />
          <ShareButton href={item.href} tone="light" iconOnly />
        </div>
      </div>

      {/* ── BOTTOM — the Nest's name and the one CTA, clear of the rail and the nav ── */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 space-y-2 px-5 pr-16 pt-5 ${z.chrome}`} style={{ paddingBottom: NAV_CLEAR }}>
        <h2 className="display text-[21px] font-black leading-[1.12] tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.45)]">{item.title}</h2>
        {item.creator.username ? (
          <div className="pointer-events-auto">
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
  // M22 — a real person's home needs no label. We used to stamp every card with the data
  // source ("Live" / "Demo" / "Example"), which read as livestream / fake to a first-time
  // visitor and made the product feel like a work in progress. Only the curated samples are
  // still marked, gently, so nobody mistakes a showcase room for someone's real Nest.
  if (source === "published") return null;
  const base = "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider";
  if (floating) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${base} bg-white/80 text-ink/55 shadow-soft ring-1 ring-black/5 backdrop-blur`}>
        Example
      </span>
    );
  }
  return <span className={`absolute left-2 top-2 ${base} bg-ink/55 text-parchment`}>Example</span>;
}
