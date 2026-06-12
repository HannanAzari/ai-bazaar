import { Compass, Search, Sparkles } from "lucide-react";
import { DiscoveryClient } from "@/components/discovery-client";
import { Footer } from "@/components/footer";

export default function DiscoverPage() {
  return (
    <>
      <section className="shell py-14">
        <div className="grain relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-900 to-teal px-6 py-12 text-white sm:px-12">
          <div className="absolute -right-16 -top-20 size-72 rounded-full bg-saffron/20 blur-3xl" />
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.2em] text-saffron"><Compass size={17} /> Places to visit</p>
            <h1 className="display mt-4 text-5xl sm:text-6xl">Who left their door open?</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/60">Search a village address, meet a new neighbour, or step into a room that catches your eye.</p>
          </div>
          <div className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl bg-white px-4 text-ink">
            <Search size={20} className="text-ink/35" />
            <input form="shop-search" name="address" placeholder="Search moon.blue.hour" className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-ink/35" />
            <Sparkles size={18} className="text-terracotta" />
          </div>
        </div>
        <DiscoveryClient />
      </section>
      <Footer />
    </>
  );
}
