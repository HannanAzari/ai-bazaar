import { ShieldCheck } from "lucide-react";
import { ModerationClient } from "@/components/moderation-client";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "Moderation",
  description: "Admin moderation queue and activity overview.",
  robots: { index: false },
};

export default function ModerationPage() {
  return (
    <>
      <section className="shell py-12">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-teal/10 text-teal"><ShieldCheck size={24} /></span>
          <div>
            <p className="eyebrow text-teal">Admin · stewardship</p>
            <h1 className="display text-4xl sm:text-5xl">Keep the village kind.</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-ink/55">
          Reports of houses, items, and owners arrive here. Mark each one reviewed, hide the
          content softly without deleting ownership, or dismiss it. Hidden places drop out of
          discovery while their history is preserved.
        </p>
        <ModerationClient />
      </section>
      <Footer />
    </>
  );
}
