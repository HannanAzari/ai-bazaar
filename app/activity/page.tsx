import { notFound } from "next/navigation";
import { Activity } from "lucide-react";
import { ActivityFeed } from "@/components/activity-feed";
import { Footer } from "@/components/footer";
import { flags } from "@/lib/flags";

export const metadata = {
  title: "Activity",
  description: "What's happening across the AI Bazaar village.",
};

export default function ActivityPage() {
  if (!flags.activityFeed) notFound();

  return (
    <>
      <section className="shell py-12">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-terracotta/10 text-terracotta"><Activity size={24} /></span>
          <div>
            <p className="eyebrow text-terracotta">Around the village</p>
            <h1 className="display text-4xl sm:text-5xl">Activity</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-ink/55">A gentle stream of what neighbours are making, liking, and saving.</p>
        <div className="mt-8 max-w-2xl">
          <ActivityFeed />
        </div>
      </section>
      <Footer />
    </>
  );
}
