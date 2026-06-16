import type { ReactNode } from "react";
import { Footer } from "@/components/footer";

// Lightweight shared shell for the pilot legal/trust placeholder pages. Plain
// text, clearly marked as draft — no legal claims beyond a pilot placeholder.

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <>
      <section className="shell max-w-2xl py-12">
        <span className="inline-block rounded-full bg-saffron/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-700">
          Draft · Pilot placeholder
        </span>
        <h1 className="display mt-4 text-4xl">{title}</h1>
        <p className="mt-3 text-ink/55">{intro}</p>
        <div className="legal-body mt-6 space-y-4 text-sm leading-relaxed text-ink/70">{children}</div>
        <p className="mt-10 text-xs text-ink/40">
          This is a placeholder for the Nestudio pilot and is not a final legal document. Last updated during the pilot-hardening sprint.
        </p>
      </section>
      <Footer />
    </>
  );
}
