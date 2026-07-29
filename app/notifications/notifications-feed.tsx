"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Heart, Loader2, MessageCircle, TriangleAlert, UserPlus } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { useNotifications } from "@/components/nest/social/use-notifications";
import { notificationHref, type CreatorNotification } from "@/lib/nest/supabase-notifications-repo";
import { getProfiles, type CreatorProfile } from "@/lib/nest/supabase-profile-repo";
import { CreatorAvatar } from "@/components/nest/app-shell/discovery";
import { nestBackend } from "@/lib/nest-repo";

// ── M24 §3 — the Notifications tab, wired to the real table ──────────────────
//
// The table has been receiving follow/like/comment rows since M23B; this page was still
// reading localStorage, so a creator never saw them. It now reads the shared inbox and has
// the four states the sprint asks for: loading, error, empty, list.
//
// Opening the tab no longer blanket-marks everything read — that made the badge useless as
// a signal of what you had actually looked at. Reading is per-row on tap, with an explicit
// "Mark all read" for clearing the lot.

export function NotificationsFeed() {
  const { signedIn, loading: identityLoading } = useNestIdentity();
  const { items, loading, error, reload, markOneRead, markEverythingRead } = useNotifications();
  const [actors, setActors] = useState<Map<string, CreatorProfile>>(new Map());

  // Resolve every actor in ONE query so each row can show a real name and @handle.
  useEffect(() => {
    if (nestBackend() !== "supabase" || items.length === 0) return;
    let alive = true;
    const ids = items.map((n) => n.actorId).filter((id): id is string => !!id);
    void getProfiles(ids).then((m) => { if (alive) setActors(m); }).catch(() => {});
    return () => { alive = false; };
  }, [items]);

  if (identityLoading) return null;

  if (!signedIn) {
    return <EmptyState title="No notifications yet" body="Sign in to see when people like, follow, or comment on your Nests." />;
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="pt-1">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="display text-3xl">Notifications</h1>
        {unread > 0 ? (
          <button onClick={markEverythingRead} className="min-h-[36px] shrink-0 text-xs font-black text-terracotta">
            Mark all read
          </button>
        ) : null}
      </div>

      {loading && items.length === 0 ? (
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-ink/45">
          <Loader2 className="size-4 animate-spin" /> Loading notifications…
        </p>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-white p-5 text-center">
          <TriangleAlert className="mx-auto size-5 text-rose-600" />
          <p className="mt-2 text-sm font-black text-rose-700">Notifications couldn&rsquo;t load</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-ink/55">{error}</p>
          <button onClick={reload} className="mt-3 min-h-[40px] rounded-full border border-timber/20 px-4 text-xs font-black text-ink/70">
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No notifications yet" body="When people interact with your Nest, you'll see it here." />
      ) : (
        <ul className="mt-4 space-y-1">
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              actor={n.actorId ? actors.get(n.actorId) : undefined}
              onRead={() => markOneRead(n.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const ICON = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
} as const;

function NotificationRow({
  n,
  actor,
  onRead,
}: {
  n: CreatorNotification;
  actor?: CreatorProfile;
  onRead: () => void;
}) {
  const Icon = ICON[n.type] ?? Bell;
  const name = actor?.displayName ?? (actor?.username ? `@${actor.username}` : "Someone");
  // "Hannan liked “My Living Room”" — the actor leads, the target is named.
  const sentence =
    n.type === "follow"
      ? `${name} started following you`
      : `${name} ${n.type === "like" ? "liked" : "commented on"} “${n.title}”`;

  return (
    <li>
      <Link
        href={notificationHref(n, actor?.username)}
        onClick={onRead}
        className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${
          n.read ? "border-transparent bg-white/60" : "border-terracotta/25 bg-white shadow-soft"
        }`}
      >
        <span className="relative shrink-0">
          <CreatorAvatar creator={{ username: actor?.username, displayName: actor?.displayName }} size={38} />
          <span className="absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-terracotta text-parchment ring-2 ring-parchment">
            <Icon className="size-2.5" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${n.read ? "text-ink/70" : "font-black text-ink"}`}>{sentence}</span>
          <span className="text-[11px] text-ink/40">{timeAgo(n.createdAt)}</span>
        </span>
        {!n.read ? <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-terracotta" /> : null}
      </Link>
    </li>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-timber/25 bg-white/60 p-10 text-center">
      <Bell className="size-6 text-ink/30" />
      <p className="display text-xl">{title}</p>
      <p className="max-w-xs text-sm text-ink/50">{body}</p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}
