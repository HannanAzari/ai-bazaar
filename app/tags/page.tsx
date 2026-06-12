import { Hash } from "lucide-react";
import { TagsClient } from "@/components/tags-client";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "Tags",
  description: "Explore AI Bazaar by tag — find houses and items that share a theme.",
};

export default function TagsPage() {
  return (
    <>
      <section className="shell py-14">
        <div className="grain relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#5c3e26] to-terracotta px-6 py-12 text-white sm:px-12">
          <div className="absolute -right-16 -top-20 size-72 rounded-full bg-lantern/20 blur-3xl" />
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-bold text-lantern"><Hash size={17} /> Explore by theme</p>
            <h1 className="display mt-4 text-5xl sm:text-6xl">Follow a thread through the village.</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/65">Every house and item can carry tags. Pick one to see everyone working on the same thing.</p>
          </div>
        </div>
        <TagsClient />
      </section>
      <Footer />
    </>
  );
}
