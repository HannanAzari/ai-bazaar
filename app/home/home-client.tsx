"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { nestThumb } from "@/components/nest/app-shell/nest-card";
import { templateToExample } from "@/components/nest/app-shell/curated";
import { getTemplates, hydrateLibrary, onProductionChanged } from "@/lib/nest-production-library";
import { listPublished, onDocsChanged, publishedUrl, type PublishedNest } from "@/lib/nest-document-store";
import type { ProductionTemplate } from "@/lib/nest-production-types";

// M15.1 — Home is the discovery/feed landing (NOT the profile dashboard, which moved to
// /profile). For this sprint it's a lightweight "wander cozy Nests" feed of real published
// + curated Nests as full-width cards that open the visitor Nest. The swipe feed and village
// discovery come later; this represents that direction without building it.

type FeedItem = { key: string; title: string; subtitle?: string; src?: string; href: string; badge?: string };

export function HomeClient() {
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

  // Published Nests lead the feed; curated examples fill it so it always feels alive.
  const feed: FeedItem[] = [
    ...published.map((entry) => ({
      key: `pub-${entry.ref.slug}`,
      title: entry.doc.title,
      subtitle: "A published Nest",
      src: nestThumb(entry.doc),
      href: publishedUrl(entry),
      badge: "Live",
    })),
    ...templates.map((t) => {
      const { doc, href } = templateToExample(t);
      return { key: `ex-${t.id}`, title: t.name, subtitle: t.persona, src: t.previewImage ?? nestThumb(doc), href };
    }),
  ];

  return (
    <div className="space-y-5 pt-1">
      <header>
        <p className="eyebrow text-terracotta">Nestudio</p>
        <h1 className="display text-3xl">Wander cozy Nests</h1>
        <p className="mt-1 text-sm text-ink/55">Step into spaces creators made their own. More houses to explore soon.</p>
      </header>

      <div className="space-y-4">
        {feed.map((item) => (
          <FeedCard key={item.key} item={item} />
        ))}
        {feed.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-timber/25 bg-white/60 p-6 text-center text-sm text-ink/50">No Nests to wander yet — be the first.</p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-timber/15 bg-gradient-to-br from-[#f6e7c6] to-[#ecd9ad] p-5 text-center shadow-soft">
        <div className="mb-1 flex items-center justify-center gap-1.5 text-terracotta"><Sparkles className="size-4" /><span className="text-xs font-black uppercase tracking-wider">Your turn</span></div>
        <p className="display text-2xl">Make a place that feels like you</p>
        <Link href="/create" className="mt-3 inline-flex items-center rounded-xl bg-terracotta px-5 py-3 text-sm font-bold text-parchment">Create your Nest</Link>
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <Link href={item.href} className="group block overflow-hidden rounded-3xl border border-timber/15 bg-white shadow-soft transition active:scale-[0.99]">
      <div className="relative aspect-[5/4] w-full bg-[#e9e0c8]">
        {item.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- local curated art
          <img src={item.src} alt={item.title} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="grid size-full place-items-center text-xs text-ink/40">No preview</div>
        )}
        {item.badge ? <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-parchment">{item.badge}</span> : null}
      </div>
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <p className="truncate font-black text-ink">{item.title}</p>
          {item.subtitle ? <p className="truncate text-xs text-ink/45">{item.subtitle}</p> : null}
        </div>
        <span className="shrink-0 rounded-full bg-parchment px-3 py-1.5 text-xs font-bold text-terracotta">Visit →</span>
      </div>
    </Link>
  );
}
