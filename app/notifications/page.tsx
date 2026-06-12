import { notFound } from "next/navigation";
import { Bell } from "lucide-react";
import { NotificationsClient } from "@/components/notifications-client";
import { Footer } from "@/components/footer";
import { flags } from "@/lib/flags";

export const metadata = { title: "Notifications", robots: { index: false } };

export default function NotificationsPage() {
  if (!flags.notifications) notFound();

  return (
    <>
      <section className="shell py-12">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-terracotta/10 text-terracotta"><Bell size={24} /></span>
          <div>
            <p className="eyebrow text-terracotta">Your village</p>
            <h1 className="display text-4xl sm:text-5xl">Notifications</h1>
          </div>
        </div>
        <NotificationsClient />
      </section>
      <Footer />
    </>
  );
}
