"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { getTemplates, hydrateLibrary, onProductionChanged } from "@/lib/nest-production-library";
import { listPublished, onDocsChanged, publishedUrl, type PublishedNest } from "@/lib/nest-document-store";
import { nestThumb } from "@/components/nest/app-shell/nest-card";
import { templateToExample } from "@/components/nest/app-shell/curated";
import type { ProductionTemplate } from "@/lib/nest-production-types";

// M15.1 — Explore is search/discovery (distinct from Home's feed). Lightweight for now:
// a search box + trending tag chips that filter curated + published Nests client-side. It
// points at the future direction (searchable nests, categories, marketplace) without
// building any of it — no likes/comments/recommendations, no backend.

type Card = { key: string; title: string; subtitle?: string; src?: string; href: string; badge?: string; tags: string[] };

export function ExploreClient() {
  const [published, setPublished] = useState<PublishedNest[]>([]);
  const [templates, setTemplates] = useState<ProductionTemplate[]>([]);
  const [query, setQuery] = useState("");

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

  const cards: Card[] = useMemo(() => [
    ...published.map((entry) => ({ key: `pub-${entry.ref.slug}`, title: entry.doc.title, subtitle: "Published", src: nestThumb(entry.doc), href: publishedUrl(entry), badge: "Live", tags: [] as string[] })),
    ...templates.map((t) => {
      const { doc, href } = templateToExample(t);
      return { key: `ex-${t.id}`, title: t.name, subtitle: t.persona, src: t.previewImage ?? nestThumb(doc), href, tags: t.tags };
    }),
  ], [published, templates]);

  // Trending tags: the most common curated tags (a stand-in for real trending).
  const trending = useMemo(() => {
    const counts = new Map<string, number>();
    templates.forEach((t) => t.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag]) => tag);
  }, [templates]);

  const q = query.trim().toLowerCase();
  const results = q
    ? cards.filter((c) => [c.title, c.subtitle ?? "", ...c.tags].join(" ").toLowerCase().includes(q))
    : cards;

  return (
    <div className="space-y-5 pt-1">
      <header>
        <h1 className="display text-3xl">Explore</h1>
        <p className="mt-1 text-sm text-ink/55">Search cozy Nests, creators, and themes.</p>
      </header>

      <div className="flex items-center gap-2 rounded-2xl border border-timber/20 bg-white px-3 shadow-soft">
        <Search className="size-4 text-ink/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Nests & themes"
          aria-label="Search"
          style={{ fontSize: 16 }}
          className="w-full bg-transparent py-3 outline-none"
        />
      </div>

      {trending.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wider text-ink/45">Trending themes</p>
          <div className="flex flex-wrap gap-2">
            {trending.map((tag) => (
              <button
                key={tag}
                onClick={() => setQuery(query === tag ? "" : tag)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${query === tag ? "border-terracotta bg-terracotta text-parchment" : "border-timber/20 bg-white text-ink/60 hover:text-ink"}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-black text-ink">{q ? "Results" : "Discover"}</h2>
          {q ? <span className="text-[11px] text-ink/45">{results.length} match{results.length === 1 ? "" : "es"}</span> : null}
        </div>
        {results.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-timber/25 bg-white/60 p-6 text-center text-sm text-ink/50">No Nests match “{query}” yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {results.map((c) => (
              <Link key={c.key} href={c.href} className="group block overflow-hidden rounded-2xl border border-timber/15 bg-white shadow-soft transition active:scale-[0.98]">
                <div className="relative aspect-[4/5] w-full bg-[#e9e0c8]">
                  {c.src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local curated art
                    <img src={c.src} alt={c.title} className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>
                  )}
                  {c.badge ? <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-parchment">{c.badge}</span> : null}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-black text-ink">{c.title}</p>
                  {c.subtitle ? <p className="truncate text-xs text-ink/45">{c.subtitle}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
