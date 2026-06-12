import { notFound } from "next/navigation";
import { ArrowLeft, DoorOpen, Map } from "lucide-react";
import { StreetWalk } from "@/components/street-walk";
import { ButtonLink } from "@/components/ui/button";
import { bazaars, getBazaar, HOUSES_PER_VILLAGE } from "@/lib/data";

export function generateStaticParams() {
  return bazaars.map((bazaar) => ({ slug: bazaar.slug }));
}

export default async function BazaarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bazaar = getBazaar(slug);
  if (!bazaar) notFound();

  return (
    <section className="min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#f4e7cf] pb-10">
      <div className="shell pt-5">
        <div className="mb-5 flex items-center justify-between">
          <ButtonLink href="/" variant="ghost" className="-ml-4"><ArrowLeft size={17} /> Village map</ButtonLink>
          <span className="flex items-center gap-2 rounded-full bg-white/65 px-3 py-2 text-xs font-bold text-ink/45"><Map size={14} /> Village {bazaars.findIndex((item) => item.id === bazaar.id) + 1} of 10</span>
        </div>
        <div className="grain relative overflow-hidden rounded-[2.5rem] border border-white/60 p-6 shadow-lift sm:p-9" style={{ backgroundColor: bazaar.soft }}>
          <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/45 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em]" style={{ color: bazaar.accent }}>
                <DoorOpen size={14} /> You entered
              </span>
              <h1 className="display mt-3 text-5xl sm:text-6xl">{bazaar.name}</h1>
              <p className="mt-2 text-lg text-ink/55">{bazaar.subtitle}</p>
            </div>
            <div className="flex gap-8">
              <div><strong className="display block text-3xl">{bazaar.claimed}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/45">Lived in</span></div>
              <div><strong className="display block text-3xl">{HOUSES_PER_VILLAGE - bazaar.claimed}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/45">Open houses</span></div>
            </div>
          </div>
        </div>
        <div className="mt-8">
          <div className="mb-5 px-1">
            <p className="eyebrow" style={{ color: bazaar.accent }}>The main walkway</p>
            <h2 className="display mt-1 text-3xl sm:text-4xl">Wander past every little door.</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/50">Enter a lived-in home, meet its maker, or claim an open house and turn it into your own studio, home, or strange little world.</p>
          </div>
          <StreetWalk bazaar={bazaar} />
        </div>
      </div>
    </section>
  );
}
