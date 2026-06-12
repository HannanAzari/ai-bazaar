"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BookOpen, Bookmark, Heart, Home, Pencil, Sparkles, UserPlus } from "lucide-react";
import { getActivity, getActivityForHandle, seedDemoActivity } from "@/lib/activity";
import type { ActivityEntry, ActivityType } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

const icons: Record<ActivityType, typeof Activity> = {
  claimed_house: Home,
  updated_house: Pencil,
  added_decoration: Sparkles,
  liked_house: Heart,
  followed_creator: UserPlus,
  guestbook_entry: BookOpen,
  saved_to_collection: Bookmark,
};

export function ActivityFeed({ handle, limit, emptyHint }: { handle?: string; limit?: number; emptyHint?: string }) {
  const [items, setItems] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (!handle) seedDemoActivity(); // seed only the global feed
    const sync = () => {
      const all = handle ? getActivityForHandle(handle) : getActivity();
      setItems(limit ? all.slice(0, limit) : all);
    };
    sync();
    window.addEventListener("ai-bazaar-activity-changed", sync);
    return () => window.removeEventListener("ai-bazaar-activity-changed", sync);
  }, [handle, limit]);

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center rounded-2xl p-8 text-center">
        <Activity className="text-ink/30" />
        <p className="mt-3 text-sm text-ink/50">{emptyHint ?? "No activity yet. Likes, follows, and guestbook notes will show up here."}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((entry) => {
        const Icon = icons[entry.type];
        return (
          <li key={entry.id} className="card flex items-start gap-3 rounded-2xl p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-terracotta/10 text-terracotta"><Icon size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed">
                <Link href={`/u/${entry.actorHandle}`} className="font-black hover:text-terracotta">{entry.actorName}</Link>{" "}
                {entry.href ? (
                  <Link href={entry.href} className="text-ink/65 hover:text-terracotta">{entry.summary}</Link>
                ) : (
                  <span className="text-ink/65">{entry.summary}</span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-ink/35">{timeAgo(entry.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
