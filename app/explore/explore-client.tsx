"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTemplates, hydrateLibrary, onProductionChanged, resolveTemplate } from "@/lib/nest-production-library";
import { encodeDoc, listPublished, onDocsChanged, publishedUrl, type PublishedNest } from "@/lib/nest-document-store";
import { nestThumb } from "@/components/nest/app-shell/nest-card";
import type { NestDocument } from "@/lib/nest-document-types";
import type { ProductionTemplate } from "@/lib/nest-production-types";

// Phase 6 — a lightweight Explore screen so the app feels alive. NOT the final feed:
// no likes, comments, or recommendations. It shows any Nests published in this browser
// plus curated example Nests built from the production templates. Curated examples open
// as real visitor Nests via the self-contained ?c= link (works with no backend).

/** A curated template rendered as a shareable example Nest (via ?c=). */
function templateToExample(t: ProductionTemplate): { doc: NestDocument; href: string } {
  const doc: NestDocument = {
    id: `example-${t.id}`,
    backgroundId: t.backgroundId,
    title: t.name,
    visibility: "public",
    placements: t.objectPlacements.map((p, i) => ({ id: `pl-${i}`, ...p })),
    createdAt: "",
    updatedAt: "",
    sourceTemplateId: t.id,
  };
  return { doc, href: `/nest/${t.id}?c=${encodeDoc(doc)}` };
}

export function ExploreClient() {
  const [published, setPublished] = useState<PublishedNest[]>([]);
  const [templates, setTemplates] = useState<ProductionTemplate[]>([]);

  useEffect(() => {
    const load = () => setPublished(listPublished());
    load();
    return onDocsChanged(load);
  }, []);

  useEffect(() => {
    const load = () => setTemplates(getTemplates({ onlyVisible: true }));
    load();
    const off = onProductionChanged(load);
    void hydrateLibrary();
    return off;
  }, []);

  const examples = templates.map(templateToExample);

  return (
    <div className="space-y-6 pt-1">
      <header>
        <h1 className="display text-3xl">Explore</h1>
        <p className="mt-1 text-sm text-ink/55">A peek into cozy Nests from the community.</p>
      </header>

      {published.length > 0 ? (
        <Section title="Recently published">
          <Grid>
            {published.slice(0, 8).map((entry) => (
              <ExploreCard key={entry.ref.slug} title={entry.doc.title} src={nestThumb(entry.doc)} href={publishedUrl(entry)} badge="Live" />
            ))}
          </Grid>
        </Section>
      ) : null}

      <Section title="Curated examples" hint="Tap to visit — then make your own.">
        {examples.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-timber/25 bg-white/60 p-6 text-center text-sm text-ink/50">No examples are published yet.</p>
        ) : (
          <Grid>
            {examples.map(({ doc, href }) => {
              const tpl = resolveTemplate(doc.sourceTemplateId ?? "");
              return <ExploreCard key={doc.id} title={doc.title} subtitle={tpl?.persona} src={tpl?.previewImage ?? nestThumb(doc)} href={href} />;
            })}
          </Grid>
        )}
      </Section>

      <div className="rounded-3xl border border-timber/15 bg-gradient-to-br from-[#f6e7c6] to-[#ecd9ad] p-5 text-center shadow-soft">
        <p className="display text-2xl">Make one that feels like you</p>
        <Link href="/create" className="mt-3 inline-flex items-center rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">Create your Nest</Link>
      </div>
    </div>
  );
}

function ExploreCard({ title, subtitle, src, href, badge }: { title: string; subtitle?: string; src?: string; href: string; badge?: string }) {
  return (
    <Link href={href} className="group block overflow-hidden rounded-2xl border border-timber/15 bg-white shadow-soft transition active:scale-[0.98]">
      <div className="relative aspect-[4/5] w-full bg-[#e9e0c8]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- local curated art
          <img src={src} alt={title} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>
        )}
        {badge ? <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-parchment">{badge}</span> : null}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-black text-ink">{title}</p>
        {subtitle ? <p className="truncate text-xs text-ink/45">{subtitle}</p> : null}
      </div>
    </Link>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-black text-ink">{title}</h2>
        {hint ? <span className="text-[11px] text-ink/45">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
