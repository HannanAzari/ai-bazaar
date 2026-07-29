"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DoorClosed, Eye, Heart, Home, Lock, MessageCircle, MoreHorizontal, Pencil, TriangleAlert, UserRound } from "lucide-react";
import { styleByKey, styleFor } from "@/lib/nest-house";
import { DoorTransition } from "@/components/nest/village/enter-transition";
import { resolveTemplate } from "@/lib/nest-production-library";
import { resolvePublished } from "@/lib/nest-repo";
import { nestBackend } from "@/lib/nest-repo";
import { listPublishedNestsByOwner } from "@/lib/nest/supabase-nest-repo";
import { getProfile, type CreatorProfile } from "@/lib/nest/supabase-profile-repo";
import { resolvePublishedBySlug } from "@/lib/nest-document-store";
import { getNestProfile, type ProfileLink } from "@/lib/nest-profile-store";
import { useRecordNestView } from "@/components/nest/social/use-record-view";
import { formatCount } from "@/lib/nest-engagement";
import { profileLinks } from "@/lib/profile-links";
import { CreatorAvatar, ShareButton } from "@/components/nest/app-shell/discovery";
import { NestPreview } from "@/components/nest/app-shell/nest-preview";
import { LikeButton } from "@/components/nest/social/like-button";
import { CommentButton } from "@/components/nest/social/comment-button";
import { FollowButton } from "@/components/nest/social/follow-button";
import { BottomSheet } from "@/components/nest/social/bottom-sheet";
import { useNestSocial } from "@/components/nest/social/use-nest-social";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { LAYER, safeBottom, safeTop, z } from "@/lib/nest-layers";
import type { NestDocument } from "@/lib/nest-document-types";

// ── M23B §6 + §9 — the full Nest ─────────────────────────────────────────────
//
// The room is the product; everything else is a guest in it. What survives on the
// permanent canvas is only what the sprint keeps:
//
//   top-left   [avatar] Nest name            (the NEST's title, not the creator's name)
//   top-right  Exit
//   right rail Like · Comments · Share
//
// Everything else moved. The creator's name, @handle, bio, stats, links and their other
// Nests live in the creator drawer behind the avatar. For the owner, Edit / Stats /
// View House live behind one discreet "…" button — administration must not sit on top of
// the artwork.
//
// §9: horizontal Nest-to-Nest swiping is GONE — the pointer handlers, the arrows, the
// pagination dots and the slide transition state with them. A visitor is in one Nest at
// a time and reaches the others through the drawer, the Profile or the House. Vertical
// scroll, object interaction and the browser's own back gesture are untouched, which is
// exactly what the swipe handler used to fight (it claimed any horizontal drag over the
// room, including drags that started on an interactive object).

type Resolution =
  | { kind: "loading" }
  | { kind: "ok"; doc: NestDocument }
  | { kind: "private" }
  | { kind: "notfound" }
  | { kind: "error"; message: string };

type Creator = {
  id?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  houseStyle?: string;
  links?: ProfileLink[];
};

export function NestVisitorClient({ slug, encoded }: { slug: string; encoded?: string }) {
  const [res, setRes] = useState<Resolution>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void resolvePublished(slug, encoded).then((r) => { if (alive) setRes(r); });
    return () => { alive = false; };
  }, [slug, encoded]);

  if (res.kind === "loading") return null;
  if (res.kind === "error") {
    // D-10: a backend failure reads as a backend failure. It never masquerades as
    // "this Nest doesn't exist", which would blame the creator for our outage.
    return (
      <Gate
        icon={<TriangleAlert className="size-8 text-terracotta" />}
        title="We couldn’t open this Nest"
        body={`Something went wrong on our side, so we can’t show it right now. ${res.message}`}
      />
    );
  }
  if (res.kind === "notfound") {
    return <Gate icon={<UserRound className="size-8 text-ink-soft" />} title="Nest not found" body="This Nest link is invalid or was never published." />;
  }
  if (res.kind === "private") {
    return <Gate icon={<Lock className="size-8 text-ink-soft" />} title="This Nest isn’t open" body="It may be private, or the link may be incomplete. Ask the creator for a fresh link." />;
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

/** One of the creator's other published Nests, for the drawer's navigator. */
type SiblingNest = { slug: string; title: string; doc: NestDocument };

function VisitorView({ doc, slug }: { doc: NestDocument; slug: string }) {
  const router = useRouter();
  const { ownerId, loading: loadingIdentity } = useNestIdentity();
  const [leaving, setLeaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creator, setCreator] = useState<Creator>({ id: doc.ownerId });
  const [siblings, setSiblings] = useState<SiblingNest[]>([]);

  const ownerFromDoc = doc.ownerId ?? resolvePublishedBySlug(slug)?.ref.ownerId;
  const isOwner = !!ownerId && ownerFromDoc === ownerId;

  // Resolve the creator + their other Nests from the SHARED store, so a visitor sees the
  // real person rather than whatever happens to be in their own browser.
  useEffect(() => {
    if (!ownerFromDoc) return;
    let alive = true;
    if (nestBackend() !== "supabase") {
      const p = getNestProfile(ownerFromDoc);
      setCreator({ id: ownerFromDoc, username: p?.username, displayName: p?.displayName, bio: p?.bio, links: p?.links });
      return;
    }
    void Promise.all([getProfile(ownerFromDoc), listPublishedNestsByOwner(ownerFromDoc)])
      .then(([profile, listings]) => {
        if (!alive) return;
        if (profile) setCreator(toCreator(profile));
        setSiblings(
          listings
            .filter((l) => !!l.slug)
            .map((l) => ({ slug: l.slug!, title: l.doc.title, doc: l.doc })),
        );
      })
      .catch(() => { /* the room still renders; the drawer just shows less */ });
    return () => { alive = false; };
  }, [ownerFromDoc]);

  const tpl = doc.sourceTemplateId ? resolveTemplate(doc.sourceTemplateId) : undefined;
  const style = useMemo(
    () => (creator.houseStyle ? styleByKey(creator.houseStyle) : styleFor(tpl?.persona)),
    [creator.houseStyle, tpl?.persona],
  );

  // M24 §2 — a real, shared view: recorded in Supabase after ~2.5s of visible dwell,
  // never for the owner, and deduplicated to one per viewer per day by the database.
  // `ready` waits for identity so the owner check is trustworthy.
  useRecordNestView(slug, { ready: !loadingIdentity, isOwner, viewerId: ownerId });

  function leave() { setLeaving(true); }
  function afterLeave() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else if (creator.username) router.push(`/@${creator.username}`);
    else router.push("/village");
  }

  return (
    <div
      className="relative mx-auto h-[100dvh] w-full max-w-[460px] overflow-hidden bg-[#e9e0c8]"
      // `touch-action: pan-y` used to exist to stop the browser's horizontal gesture
      // fighting our own swipe handler. The handler is gone, so the browser gets its
      // gestures back — including edge-swipe Back on iOS Safari.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {leaving ? <DoorTransition style={style} mode="exit" onDone={afterLeave} label="Heading back out…" /> : null}

      {/* ── ROOM (LAYER.room / objects) — the exact canonical composition ──────
          Same NestPreview, same lib/nest-geometry placementBox, as the editor. */}
      <div className={`absolute inset-0 ${z.room}`}>
        <NestPreview doc={doc} className="absolute inset-0 size-full" interactive />
      </div>

      <div
        className={`nest-ambient pointer-events-none absolute inset-0 ${z.scrim}`}
        style={{ background: "radial-gradient(60% 42% at 50% 40%, rgba(255,222,160,0.5), transparent 72%)" }}
      />
      {/* Legibility scrims. The bottom one is now shallow — there is no longer a block of
          metadata down there that needed hiding behind a gradient. */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent ${z.scrim}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent ${z.scrim}`} />

      {/* ── TOP (LAYER.chrome) — [avatar] NEST NAME · Exit ────────────────────── */}
      <header
        className={`absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 ${z.chrome}`}
        style={{ paddingTop: safeTop() }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex min-w-0 items-center gap-2.5 rounded-full bg-black/25 py-1.5 pl-1.5 pr-3.5 backdrop-blur-sm transition active:scale-95"
          aria-label={`${doc.title} — view creator`}
        >
          <CreatorAvatar creator={creator} size={40} tone="light" />
          {/* The pill names the NEST. The creator is one tap away, not competing with it. */}
          <span className="min-w-0 truncate text-left text-[15px] font-black tracking-tight text-white">{doc.title}</span>
        </button>

        <div className="flex flex-none items-center gap-2">
          {isOwner ? <OwnerMenu slug={slug} docId={doc.id} handle={creator.username} /> : null}
          <button
            onClick={leave}
            aria-label="Exit this Nest"
            className="inline-flex items-center gap-1 rounded-full bg-black/30 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-black/40 active:scale-95"
          >
            <DoorClosed className="size-3.5" /> Exit
          </button>
        </div>
      </header>

      {/* ── RIGHT RAIL (LAYER.chrome) — Like · Comments · Share ────────────────── */}
      <div className={`absolute bottom-0 right-3 ${z.chrome}`} style={{ paddingBottom: safeBottom() }}>
        <div className="flex flex-col items-center gap-5 pb-2 [&_button]:[text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
          <LikeButton nestId={slug} tone="light" ownerId={ownerFromDoc} nestTitle={doc.title} />
          <CommentButton nestId={slug} tone="light" ownerId={ownerFromDoc} nestTitle={doc.title} />
          <ShareButton href={`/nest/${slug}`} tone="light" iconOnly />
        </div>
      </div>

      <CreatorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        creator={creator}
        isOwner={isOwner}
        siblings={siblings}
        currentSlug={slug}
      />
    </div>
  );
}

function toCreator(p: CreatorProfile): Creator {
  return { id: p.id, username: p.username, displayName: p.displayName, bio: p.bio, houseStyle: p.houseStyle, links: p.links };
}

// ── Owner menu ───────────────────────────────────────────────────────────────
//
// Was three permanent buttons (Edit Nest / View House / Stats) sitting across the bottom
// of the room. Now one 40px "…" in the header, opening a sheet. The owner sees their Nest
// the way a visitor does, and administration is one tap away rather than always present.
function OwnerMenu({ slug, docId, handle }: { slug: string; docId: string; handle?: string }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Owner options"
        className="grid size-9 place-items-center rounded-full bg-black/30 text-white backdrop-blur-sm transition active:scale-95"
      >
        <MoreHorizontal className="size-4" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Your Nest">
        <div className="space-y-2 p-4 pt-1">
          <Link
            href={`/nest-editor?document=${docId}`}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-timber/15 bg-white px-4 text-[15px] font-black text-ink active:scale-[0.99]"
          >
            <Pencil className="size-4 text-ink/45" /> Edit Nest
          </Link>
          <button
            onClick={() => { setOpen(false); setStats(true); }}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-timber/15 bg-white px-4 text-left text-[15px] font-black text-ink active:scale-[0.99]"
          >
            <Eye className="size-4 text-ink/45" /> Stats
          </button>
          {handle ? (
            <Link
              href={`/@${handle}`}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-timber/15 bg-white px-4 text-[15px] font-black text-ink active:scale-[0.99]"
            >
              <Home className="size-4 text-ink/45" /> View House
            </Link>
          ) : null}
        </div>
      </BottomSheet>

      <StatsSheet open={stats} onClose={() => setStats(false)} slug={slug} />
    </>
  );
}

function StatsSheet({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const { likeCount, commentCount } = useNestSocial(slug);
  const stats = [
    { icon: <Heart className="size-4" />, label: "Likes", value: likeCount },
    { icon: <MessageCircle className="size-4" />, label: "Comments", value: commentCount },
  ];
  return (
    <BottomSheet open={open} onClose={onClose} title="Your Nest, today">
      <div className="grid grid-cols-2 gap-2 p-4 pt-1">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-timber/15 bg-white p-3 text-center shadow-soft">
            <span className="mx-auto flex size-5 items-center justify-center text-terracotta">{s.icon}</span>
            <p className="mt-0.5 text-sm font-black text-ink">{formatCount(s.value)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{s.label}</p>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

// ── Creator drawer ───────────────────────────────────────────────────────────
//
// The one place the creator's identity lives while you are inside their Nest: name,
// @handle, bio, stats, Follow, links, and their other Nests. Selecting another Nest
// NAVIGATES to it (a real route change, one Nest at a time) rather than sliding the
// canvas sideways — D-06.
function CreatorDrawer({
  open,
  onClose,
  creator,
  isOwner,
  siblings,
  currentSlug,
}: {
  open: boolean;
  onClose: () => void;
  creator: Creator;
  isOwner: boolean;
  siblings: SiblingNest[];
  currentSlug: string;
}) {
  if (!open) return null;
  const name = creator.displayName ?? (creator.username ? `@${creator.username}` : "A Nestudio creator");
  const links = profileLinks({ links: creator.links });

  return (
    <div className={`fixed inset-0 flex ${z.drawer}`} onClick={onClose}>
      <style>{`@keyframes drawer-in { from { transform: translateX(-100%) } to { transform: translateX(0) } } .drawer-in { animation: drawer-in .34s cubic-bezier(.32,.72,0,1) both } @media (prefers-reduced-motion: reduce) { .drawer-in { animation: none } }`}</style>
      <div className="absolute inset-0 bg-black/30" />
      <aside
        className="drawer-in relative flex h-full w-[86%] max-w-[340px] flex-col gap-3 overflow-y-auto rounded-r-3xl border-r border-timber/15 bg-parchment p-5 shadow-lift"
        style={{ paddingTop: safeTop("1.25rem"), paddingBottom: safeBottom() }}
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

        <p className="text-[11px] text-ink/45">
          <span className="font-bold text-ink/60">{formatCount(siblings.length)}</span>{" "}
          {siblings.length === 1 ? "Nest" : "Nests"}
        </p>

        {creator.id && !isOwner ? <div className="flex"><FollowButton creatorId={creator.id} /></div> : null}

        {links.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-[32px] items-center rounded-full border border-timber/20 bg-white px-3 text-[12px] font-bold text-ink/70"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {siblings.length > 0 ? (
          <nav aria-label="Published Nests" className="mt-1 space-y-1 border-t border-timber/10 pt-3">
            {siblings.map((s) => {
              const active = s.slug === currentSlug;
              return (
                <Link
                  key={s.slug}
                  href={`/nest/${s.slug}`}
                  onClick={onClose}
                  aria-current={active ? "true" : undefined}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm font-bold transition ${
                    active ? "bg-terracotta/12 text-ink" : "text-ink/70 hover:bg-white/70"
                  }`}
                >
                  <span className="size-9 shrink-0 overflow-hidden rounded-lg border border-timber/15">
                    <NestPreview doc={s.doc} className="h-full w-full" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  {active ? <span className="size-1.5 shrink-0 rounded-full bg-terracotta" /> : null}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {creator.username ? (
          <Link
            href={`/@${creator.username}`}
            style={{ zIndex: LAYER.drawer }}
            className="mt-auto flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-timber/20 bg-white text-sm font-black text-ink active:scale-95"
          >
            <Home className="size-4" /> Visit House
          </Link>
        ) : null}
      </aside>
    </div>
  );
}
