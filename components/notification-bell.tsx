"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { seedDemoNotifications, unreadCount } from "@/lib/notifications";

export function NotificationBell() {
  // Start at 0 so server and first client render match; real count loads after mount.
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    seedDemoNotifications();
    const sync = () => setUnread(unreadCount());
    sync();
    window.addEventListener("ai-bazaar-notifications-changed", sync);
    return () => window.removeEventListener("ai-bazaar-notifications-changed", sync);
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative flex size-10 items-center justify-center rounded-full hover:bg-white/70"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 grid min-w-[16px] place-items-center rounded-full bg-terracotta px-1 text-[9px] font-black leading-4 text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
