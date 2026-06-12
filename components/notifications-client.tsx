"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BookOpen, CheckCheck, Eye, Heart, MousePointerClick, ShieldCheck, UserPlus } from "lucide-react";
import { getNotifications, markAllRead, markRead } from "@/lib/notifications";
import type { Notification, NotificationType } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

const icons: Record<NotificationType, typeof Bell> = {
  house_view: Eye,
  like: Heart,
  follow: UserPlus,
  guestbook_entry: BookOpen,
  item_click: MousePointerClick,
  report_status: ShieldCheck,
};

function Row({ item }: { item: Notification }) {
  const Icon = icons[item.type];
  const body = (
    <div className={cn("card flex items-start gap-3 rounded-2xl p-4 transition", !item.read && "border-terracotta/30 bg-terracotta/5")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", item.read ? "bg-ink/5 text-ink/45" : "bg-terracotta/15 text-terracotta")}><Icon size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-black">{item.title}</p>
          {!item.read && <span className="size-2 rounded-full bg-terracotta" aria-label="Unread" />}
        </div>
        <p className="mt-0.5 text-sm text-ink/60">{item.body}</p>
        <p className="mt-1 text-[11px] text-ink/35">{timeAgo(item.createdAt)}</p>
      </div>
      <button
        onClick={(event) => { event.preventDefault(); markRead(item.id, !item.read); }}
        className="shrink-0 rounded-full border border-ink/10 px-2.5 py-1 text-[11px] font-bold text-ink/50 hover:border-terracotta hover:text-terracotta"
      >
        {item.read ? "Unread" : "Read"}
      </button>
    </div>
  );

  return item.href ? (
    <Link href={item.href} onClick={() => markRead(item.id, true)} className="block">{body}</Link>
  ) : (
    body
  );
}

export function NotificationsClient() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    const sync = () => setItems(getNotifications());
    sync();
    window.addEventListener("ai-bazaar-notifications-changed", sync);
    return () => window.removeEventListener("ai-bazaar-notifications-changed", sync);
  }, []);

  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/55">{unread > 0 ? `${unread} unread` : "All caught up"}</p>
        {unread > 0 && (
          <button onClick={markAllRead} className="inline-flex items-center gap-2 rounded-full border border-timber/20 bg-parchment/70 px-3 py-1.5 text-xs font-bold text-ink-soft hover:border-terracotta hover:text-terracotta">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card mt-5 flex flex-col items-center rounded-3xl p-12 text-center">
          <Bell className="text-ink/30" />
          <p className="mt-3 text-ink/55">No notifications yet. Visits, likes, follows, and guestbook notes will land here.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => <Row key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
