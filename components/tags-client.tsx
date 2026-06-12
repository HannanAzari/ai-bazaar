"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Hash, Search } from "lucide-react";
import { useAllShops } from "@/components/providers/demo-provider";
import { tagCounts } from "@/lib/tags";

export function TagsClient() {
  const shops = useAllShops();
  const [query, setQuery] = useState("");
  const counts = useMemo(() => tagCounts(shops), [shops]);
  const filtered = query
    ? counts.filter((entry) => entry.tag.includes(query.toLowerCase().replace(/[^a-z0-9]/g, "")))
    : counts;
  const max = counts[0]?.count ?? 1;

  return (
    <div className="mt-8">
      <div className="flex max-w-xl items-center gap-3 rounded-2xl border border-timber/15 bg-white px-4 shadow-soft">
        <Search size={20} className="text-ink/35" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tags — painting, tea, music…"
          aria-label="Search tags"
          className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-ink/35"
        />
      </div>

      <h2 className="display mt-10 text-2xl">{query ? "Matching tags" : "Popular tags"}</h2>
      {filtered.length ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {filtered.map((entry) => (
            <Link
              key={entry.tag}
              href={`/tags/${entry.tag}`}
              className="group inline-flex items-center gap-2 rounded-full border border-timber/20 bg-parchment/80 py-2 pl-3 pr-2 font-bold text-ink-soft shadow-soft transition hover:-translate-y-0.5 hover:border-terracotta hover:text-terracotta"
              style={{ fontSize: `${0.82 + (entry.count / max) * 0.5}rem` }}
            >
              <Hash size={14} className="opacity-50" />
              {entry.tag}
              <span className="grid min-w-6 place-items-center rounded-full bg-terracotta/10 px-1.5 py-0.5 text-[11px] text-terracotta">{entry.count}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-ink/50">No tags match “{query}”.</p>
      )}
    </div>
  );
}
