"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, DoorClosed, Eye, Heart, Home, Lock, MessageCircle, Pencil, UserRound } from "lucide-react";
import { styleFor } from "@/lib/nest-house";
import { DoorTransition } from "@/components/nest/village/enter-transition";
import { resolveTemplate } from "@/lib/nest-production-library";
import { resolvePublished } from "@/lib/nest-repo";
import { resolvePublishedBySlug } from "@/lib/nest-document-store";
import { getNestProfile } from "@/lib/nest-profile-store";
import { commentCount, followerCount, likeCount, onSocialChanged, recordView, viewCount, viewsForOwner } from "@/lib/nest-social";
import { formatCount } from "@/lib/nest-engagement";
import { CreatorAvatar, NestTags, ShareButton } from "@/components/nest/app-shell/discovery";
import { NestPreview } from "@/components/nest/app-shell/nest-preview";
import { LikeButton } from "@/components/nest/social/like-button";
import { CommentButton } from "@/components/nest/social/comment-button";
import { FollowButton } from "@/components/nest/social/follow-button";
import { BottomSheet } from "@/components/nest/social/bottom-sheet";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { reelNeighbours, viewableReel, reelIndexOf, type ReelEntry } from "@/lib/nest-reel";
import type { NestDocument } from "@/lib/nest-document-types";

type Resolution =
  | { kind: "loading" }
  | { kind: "ok"; doc: NestDocument }
  | { kind: "private" }
  | { kind: "notfound" };

type Creator = { id?: string; username?: string; displayName?: string; bio?: string };

export function NestVisitorClient({ slug, encoded }: { slug: string; encoded?: string }) {
  const [res, setRes] = useState<Resolution>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    resolvePublished(slug, encoded).then((r) => { if (alive) setRes(r); });
    return () => { alive = false; };
  }, [slug, encoded]);

  if (res.kind === "loading") return null;
  if (res.kind === "notfound") {
    return <Gate icon={<UserRound className="size-8 text-ink-soft" />} title="Nest not found" body="This Nest link is invalid or was never published." />;
  }
  if (res.kind === "private") {
    // M22 — this state is reached both when a Nest really is private AND when a link simply
    // can't be resolved (an incomplete share link). Claiming "the owner hasn't shared this"
    // blames the creator for what is often a broken link, so the copy now covers both
    // honestly without pretending to know which happened.
    return <Gate icon={<Lock className="size-8 text-ink-soft" />} title="This Nest isn't open" body="It may be private, or the link may be incomplete. Ask the creator for a fresh link." />;
  }
  return <VisitorView doc={res.doc} slug={slug} />;
}

function Gate({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[460px] flex-col items-center justify-center gap-3 px-4 text-center">
      {icon}
      <h1 className="display text-2xl">{title}</h1>
      <p className="max-w-xs text-sm text-ink-soft">{body}</p>
      <div className="mt-2 flex gap-2">
        <Link href="/create" className="rounded-xl bg-terracotta px-4 py-2.5 text-sm font-bold text-parchment">Create your own</Link>
        <Link href="/home" className="rounded-xl border border-timber/20 bg-white px-4 py-2.5 text-sm font-bold text-ink/70">Explore Nests</Link>
      </div>
    </div>
  );
}

// Beta Polish FINAL — a fullscreen, Reels-style Nest viewer: the composed room is the hero,
// edge to edge, with only floating overlays on top. Identity (top-left, taps into a creator
// drawer) · Exit (top-right) · engagement rail (right) · title + Visit House (bottom-left).
// One phone screen, no page scroll, for both visitors and the owner.
function VisitorView({ doc, slug }: { doc: NestDocument; slug: string }) {
  const router = useRouter();
  const { ownerId } = useNestIdentity();
  const [leaving, setLeaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const localRef = resolvePublishedBySlug(slug);
  const ownerFromDoc = doc.ownerId ?? localRef?.ref.ownerId;
  const localDoc = localRef?.doc;
  const profile = ownerFromDoc ? getNestProfile(ownerFromDoc) : null;
  const creator: Creator = { id: ownerFromDoc, username: profile?.username, displayName: profile?.displayName, bio: profile?.bio };
  const templateId = doc.sourceTemplateId ?? localDoc?.sourceTemplateId;
  const tpl = templateId ? resolveTemplate(templateId) : undefined;
  const tags = tpl?.tags ?? [];
  const style = styleFor(tpl?.persona);

  // M19.1 return journey — the door closes behind you, then back to where you came.
  function leave() { setLeaving(true); }
  function afterLeave() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else if (creator.username) router.push(`/@${creator.username}`);
    else router.push("/village");
  }
  const isOwner = !!ownerId && ownerFromDoc === ownerId;
  const editDocId = localDoc?.id ?? doc.id;
  const name = creator.displayName ?? (creator.username ? `@${creator.username}` : "A Nestudio creator");

  // Count the visit once per load — skip the owner's own views (real analytics).
  useEffect(() => {
    if (ownerId === undefined) return; // wait until identity resolves
    if (!isOwner) recordView(slug);
  }, [slug, isOwner, ownerId]);

  // ── The Nest reel ──────────────────────────────────────────────────────────
  // Stay inside the immersive view while moving between this creator's Nests. Visitors
  // only ever reach shareable Nests; the owner moves through all of their own. A direct
  // URL still opens the right Nest — this only adds lateral movement on top.
  const reel = useMemo(() => viewableReel(ownerFromDoc, isOwner), [ownerFromDoc, isOwner]);
  const { prev, next } = useMemo(() => reelNeighbours(reel, slug), [reel, slug]);
  const position = reelIndexOf(reel, slug);
  // Item 12 — switching should feel like walking between rooms, not flipping pages: a brief
  // directional slide (~250ms) before the next Nest takes over. Reduced motion skips it.
  const [slide, setSlide] = useState<"left" | "right" | null>(null);
  const go = useCallback((entry?: ReelEntry, dir: "left" | "right" = "left") => {
    if (!entry) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { router.push(entry.url); return; }
    setSlide(dir);
    setTimeout(() => router.push(entry.url), 240);
  }, [router]);

  // Touch swipe + keyboard fallback (arrows are rendered too, for mouse/AT).
  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { start.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current; start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.3) return; // vertical/short → ignore
    if (dx < 0) go(next, "left"); else go(prev, "right");
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(next, "left");
      if (e.key === "ArrowLeft") go(prev, "right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, next, prev]);

  return (
    <div
      className="relative mx-auto h-[100dvh] w-full max-w-[460px] overflow-hidden bg-[#e9e0c8]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <style>{`@keyframes nest-out-left { to { transform: translateX(-6%); opacity: .25 } } @keyframes nest-out-right { to { transform: translateX(6%); opacity: .25 } } @keyframes nest-in { from { transform: translateX(4%); opacity: .4 } to { transform: none; opacity: 1 } } .nest-slide-left { animation: nest-out-left .24s ease-in both } .nest-slide-right { animation: nest-out-right .24s ease-in both } .nest-enter { animation: nest-in .25s cubic-bezier(.32,.72,0,1) both } @media (prefers-reduced-motion: reduce) { .nest-slide-left, .nest-slide-right, .nest-enter { animation: none } }`}</style>
      {leaving ? <DoorTransition style={style} mode="exit" onDone={afterLeave} label="Heading back out…" /> : null}

      {/* HERO — the composed room fills the whole screen */}
      <div className={`absolute inset-0 ${slide === "left" ? "nest-slide-left" : slide === "right" ? "nest-slide-right" : "nest-enter"}`}>
        <NestPreview doc={doc} className="absolute inset-0 size-full" />
      </div>
      {/* the room's warm light breathes very subtly */}
      <div className="nest-ambient pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 42% at 50% 40%, rgba(255,222,160,0.5), transparent 72%)" }} />

      {/* Legibility scrims — a whisper up top, a soft shallow scrim at the base. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

      {/* TOP — creator (taps into a drawer) + Exit */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4" style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}>
        <button onClick={() => setDrawerOpen(true)} className="flex min-w-0 items-center gap-2.5 rounded-full bg-black/25 py-1.5 pl-1.5 pr-3.5 backdrop-blur-sm transition active:scale-95" aria-label="View creator">
          <CreatorAvatar creator={creator} size={40} tone="light" />
          <span className="min-w-0 leading-tight text-left">
            <span className="block truncate text-[15px] font-black tracking-tight text-white">{name}</span>
            {creator.username ? <span className="block truncate text-[11px] font-medium text-white/75">@{creator.username}</span> : null}
          </span>
        </button>
        <button onClick={leave} className="inline-flex flex-none items-center gap-1 rounded-full bg-black/30 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-black/40 active:scale-95">
          <DoorClosed className="size-3.5" /> Exit
        </button>
      </header>

      {/* RIGHT — Reels-style engagement rail */}
      <div className="absolute bottom-0 right-3 z-20" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}>
        <div className="flex flex-col items-center gap-5 pb-2 [&_button]:[text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
          <LikeButton nestId={slug} tone="light" />
          <CommentButton nestId={slug} tone="light" />
          <ShareButton href={`/nest/${slug}`} tone="light" iconOnly />
        </div>
      </div>

      {/* BOTTOM-LEFT — title, tags, and the primary actions */}
      <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 px-5 pr-16 pt-10" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}>
        <h1 className="display text-2xl leading-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.5)]">{doc.title}</h1>
        {tags.length > 0 ? <NestTags tags={tags} max={3} tone="light" /> : null}
        {isOwner ? (
          <OwnerActions slug={slug} editDocId={editDocId} handle={creator.username} />
        ) : creator.username ? (
          <Link href={`/@${creator.username}`} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-terracotta px-5 py-2.5 text-sm font-black text-parchment shadow-lift transition active:scale-95">
            <Home className="size-4" /> Visit House
          </Link>
        ) : null}
      </div>

      {/* Reel navigation — subtle position dots + arrow fallback for mouse/AT users. */}
      {reel.length > 1 ? (
        <>
          {prev ? (
            <button onClick={() => go(prev, "right")} aria-label={`Previous Nest: ${prev.title}`}
              className="absolute left-2 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white backdrop-blur-sm transition active:scale-90">
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {next ? (
            <button onClick={() => go(next, "left")} aria-label={`Next Nest: ${next.title}`}
              className="absolute right-2 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white backdrop-blur-sm transition active:scale-90">
              <ChevronRight className="size-5" />
            </button>
          ) : null}
          <div className="absolute inset-x-0 z-20 flex justify-center gap-1.5" style={{ top: "max(env(safe-area-inset-top), 0.75rem)", marginTop: "3.25rem" }}
            aria-label={`Nest ${position + 1} of ${reel.length}`} role="status">
            {reel.map((r, i) => (
              <span key={r.slug} className={`h-1 rounded-full transition-all ${i === position ? "w-5 bg-white" : "w-1.5 bg-white/45"}`} />
            ))}
          </div>
        </>
      ) : null}

      <CreatorDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} creator={creator} isOwner={isOwner}
        reel={reel} currentSlug={slug} onSelect={(entry) => go(entry, "left")} />
    </div>
  );
}

// Owner keeps management on the same fullscreen viewer: edit, view their house, and peek
// real stats in a bottom sheet — never a wall of analytics cards over the room.
function OwnerActions({ slug, editDocId, handle }: { slug: string; editDocId: string; handle?: string }) {
  const [statsOpen, setStatsOpen] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/nest-editor?document=${editDocId}`} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-black text-parchment shadow-lift active:scale-95">
          <Pencil className="size-4" /> Edit Nest
        </Link>
        {handle ? (
          <Link href={`/@${handle}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-2.5 text-sm font-black text-ink shadow-lift active:scale-95">
            <Home className="size-4" /> View House
          </Link>
        ) : null}
        <button onClick={() => setStatsOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm active:scale-95">
          <Eye className="size-4" /> Stats
        </button>
      </div>
      <StatsSheet open={statsOpen} onClose={() => setStatsOpen(false)} slug={slug} />
    </>
  );
}

function StatsSheet({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const { ownerId } = useNestIdentity();
  const [n, setN] = useState({ views: 0, likes: 0, comments: 0, followers: 0 });
  useEffect(() => {
    if (!open) return;
    const refresh = () => setN({ views: viewCount(slug), likes: likeCount(slug), comments: commentCount(slug), followers: ownerId ? followerCount(ownerId) : 0 });
    refresh();
    return onSocialChanged(refresh);
  }, [open, slug, ownerId]);

  const stats = [
    { icon: <Eye className="size-4" />, label: "Views", value: n.views },
    { icon: <Heart className="size-4" />, label: "Likes", value: n.likes },
    { icon: <MessageCircle className="size-4" />, label: "Comments", value: n.comments },
    { icon: <UserRound className="size-4" />, label: "Followers", value: n.followers },
  ];
  return (
    <BottomSheet open={open} onClose={onClose} title="Your Nest, today">
      <div className="grid grid-cols-4 gap-2 p-4 pt-1">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-timber/15 bg-white p-2 text-center shadow-soft">
            <span className="mx-auto flex size-5 items-center justify-center text-terracotta">{s.icon}</span>
            <p className="mt-0.5 text-sm font-black text-ink">{formatCount(s.value)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{s.label}</p>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

// M20 — the creator hub. Avatar · name · @handle · bio · three quiet stats · Follow directly
// beneath the identity (not buried at the bottom) · and the creator's published Nests as a
// quick navigator. Selecting one switches the Nest underneath without leaving the experience;
// the room stays partially visible behind the drawer.
function CreatorDrawer({
  open, onClose, creator, isOwner, reel, currentSlug, onSelect,
}: {
  open: boolean; onClose: () => void; creator: Creator; isOwner: boolean;
  reel: ReelEntry[]; currentSlug: string; onSelect: (entry: ReelEntry) => void;
}) {
  const [c, setC] = useState({ followers: 0, views: 0 });
  useEffect(() => {
    if (!open || !creator.id) return;
    const refresh = () => setC({ followers: followerCount(creator.id!), views: viewsForOwner(creator.id!) });
    refresh();
    return onSocialChanged(refresh);
  }, [open, creator.id]);

  if (!open) return null;
  const name = creator.displayName ?? (creator.username ? `@${creator.username}` : "A Nestudio creator");
  return (
    <div className="fixed inset-0 z-[60] flex" onClick={onClose}>
      <style>{`@keyframes drawer-in { from { transform: translateX(-100%) } to { transform: translateX(0) } } .drawer-in { animation: drawer-in .34s cubic-bezier(.32,.72,0,1) both } @media (prefers-reduced-motion: reduce) { .drawer-in { animation: none } }`}</style>
      {/* lighter scrim — the room stays partially visible, so this reads as a panel over the
          room rather than navigating away from it */}
      <div className="absolute inset-0 bg-black/30" />
      <aside
        className="drawer-in relative flex h-full w-[86%] max-w-[340px] flex-col gap-3 overflow-y-auto rounded-r-3xl border-r border-timber/15 bg-parchment p-5 shadow-lift"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)", paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <CreatorAvatar creator={creator} size={56} />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-black leading-tight text-ink">{name}</p>
            {creator.username ? <p className="truncate text-[13px] font-medium text-ink/55">@{creator.username}</p> : null}
          </div>
        </div>

        {creator.bio ? <p className="text-[13px] leading-snug text-ink/70">{creator.bio}</p> : null}

        {/* one quiet row — same three metrics as the profile */}
        <p className="text-[11px] text-ink/45">
          <span className="font-bold text-ink/60">{formatCount(reel.length)}</span> {reel.length === 1 ? "Nest" : "Nests"}
          {" · "}<span className="font-bold text-ink/60">{formatCount(c.views)}</span> {c.views === 1 ? "View" : "Views"}
          {" · "}<span className="font-bold text-ink/60">{formatCount(c.followers)}</span> {c.followers === 1 ? "Follower" : "Followers"}
        </p>

        {/* Follow sits immediately under the identity — the obvious available action */}
        {creator.id && !isOwner ? <div className="flex"><FollowButton creatorId={creator.id} /></div> : null}

        {/* quick navigator — switch Nest without leaving the immersive view */}
        {reel.length > 0 ? (
          <nav aria-label="Published Nests" className="mt-1 space-y-1 border-t border-timber/10 pt-3">
            {reel.map((r) => {
              const active = r.slug === currentSlug;
              return (
                <button
                  key={r.slug}
                  onClick={() => { onSelect(r); onClose(); }}
                  aria-current={active ? "true" : undefined}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm font-bold transition ${active ? "bg-terracotta/12 text-ink" : "text-ink/70 hover:bg-white/70"}`}
                >
                  <span className="size-9 shrink-0 overflow-hidden rounded-lg border border-timber/15">
                    <NestPreview doc={r.entry.doc} className="h-full w-full" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  {active ? <span className="size-1.5 shrink-0 rounded-full bg-terracotta" /> : null}
                </button>
              );
            })}
          </nav>
        ) : null}

        {creator.username ? (
          <Link href={`/@${creator.username}`} className="mt-auto flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-timber/20 bg-white text-sm font-black text-ink active:scale-95">
            <Home className="size-4" /> Visit House
          </Link>
        ) : null}
      </aside>
    </div>
  );
}

