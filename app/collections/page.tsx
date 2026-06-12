import { notFound } from "next/navigation";
import { Bookmark } from "lucide-react";
import { CollectionsClient } from "@/components/collections-client";
import { Footer } from "@/components/footer";
import { flags } from "@/lib/flags";

export const metadata = { title: "Collections", robots: { index: false } };

export default function CollectionsPage() {
  if (!flags.collections) notFound();

  return (
    <>
      <section className="shell py-12">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-saffron/15 text-saffron"><Bookmark size={24} /></span>
          <div>
            <p className="eyebrow text-terracotta">Your saves</p>
            <h1 className="display text-4xl sm:text-5xl">Collections</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-ink/55">Keep the houses and items you love in tidy little folders — favourites, inspiration, and places you want to visit.</p>
        <CollectionsClient />
      </section>
      <Footer />
    </>
  );
}
