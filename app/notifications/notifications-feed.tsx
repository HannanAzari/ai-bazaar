"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Heart, MessageCircle, UserPlus } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { getNestProfile } from "@/lib/nest-profile-store";
import { listNotifications, markAllRead, onNotificationsChanged, type NestNotification } from "@/lib/nest-notifications-store";

// M18 — the Notifications tab: a real, newest-first inbox of likes / follows / comments.
// Opening the tab marks everything read (clears the nav badge). No push, no email.
export function NotificationsFeed() {
  const { ownerId, signedIn, loading } = useNestIdentity();
  const [items, setItems] = useState<NestNotification[]>([]);

  useEffect(() => {
    if (!ownerId) return;
    const refresh = () => setItems(listNotifications(ownerId));
    refresh();
    const off = onNotificationsChanged(refresh);
    markAllRead(ownerId); // opening the tab clears unread
    return off;
  }, [ownerId]);

  if (loading) return null;

  if (!signedIn) {
    return (
      <EmptyState title="No notifications yet" body="Sign in to see when people like, follow, or comment on your Nests." />
    );
  }

  if (items.length === 0) {
    return <EmptyState title="No notifications yet" body="When people interact with your Nest, you'll see it here." />;
  }

  return (
    <div className="pt-1">
      <h1 className="display text-3xl">Notifications</h1>
      <ul className="mt-4 space-y-1">
        {items.map((n) => <NotificationRow key={n.id} n={n} />)}
      </ul>
    </div>
  );
}

function NotificationRow({ n }: { n: NestNotification }) {
  const actor = getNestProfile(n.actorId);
  const name = actor?.username ? `@${actor.username}` : actor?.displayName ?? "Someone";
  const initial = (actor?.username ?? actor?.displayName ?? "N").charAt(0).toUpperCase();
  const { verb, Icon, href } = describe(n, actor?.username);
  return (
    <li>
      <Link href={href} className={`flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-white/60 ${n.read ? "" : "bg-white/70"}`}>
        <span className="relative shrink-0">
          <span className="grid size-10 place-items-center rounded-full bg-terracotta text-sm font-black text-parchment">{initial}</span>
          <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-white text-terracotta shadow-soft"><Icon className="size-3" /></span>
        </span>
        <p className="min-w-0 flex-1 text-sm text-ink/80">
          <span className="font-black text-ink">{name}</span> {verb}
          <span className="ml-1.5 text-[11px] text-ink/40">{timeAgo(n.createdAt)}</span>
        </p>
        {!n.read ? <span className="size-2 shrink-0 rounded-full bg-terracotta" /> : null}
      </Link>
    </li>
  );
}

function describe(n: NestNotification, actorUsername?: string): { verb: string; Icon: typeof Heart; href: string } {
  if (n.type === "like") return { verb: "liked your Nest", Icon: Heart, href: `/nest/${n.entityId}` };
  if (n.type === "comment") return { verb: "commented on your Nest", Icon: MessageCircle, href: `/nest/${n.entityId}` };
  return { verb: "started following you", Icon: UserPlus, href: actorUsername ? `/@${actorUsername}` : "/profile" };
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="pt-1">
      <h1 className="display text-3xl">Notifications</h1>
      <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-timber/25 bg-white/60 p-10 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-[#efe7cf] text-terracotta"><Bell className="size-7" /></span>
        <p className="display text-2xl">{title}</p>
        <p className="max-w-xs text-sm text-ink/50">{body}</p>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
