import { NestAppChrome } from "@/components/nest/app-shell/nest-app-chrome";
import { NotificationsFeed } from "./notifications-feed";

export const metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

// M18 — the app-shell Notifications tab: a real inbox (likes / follows / comments).
// `/updates` redirects here.
export default function NotificationsPage() {
  return (
    <NestAppChrome>
      <NotificationsFeed />
    </NestAppChrome>
  );
}
