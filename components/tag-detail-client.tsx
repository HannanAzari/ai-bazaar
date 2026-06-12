"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, Armchair, ImageIcon, Link2, Sparkles, Type } from "lucide-react";
import { useAllShops } from "@/components/providers/demo-provider";
import { ShopCard } from "@/components/shop-card";
import { housesForTag, itemsForTag } from "@/lib/tags";
import { useHiddenRefs } from "@/lib/use-hidden";

const decoIcons = { text: Type, image: ImageIcon, "ai-image": Sparkles, link: Link2, furniture: Armchair };

export function TagDetailClient({ tag }: { tag: string }) {
  const shops = useAllShops();
  const hidden = useHiddenRefs();
  const houses = useMemo(() => housesForTag(shops, tag).filter((shop) => !hidden.has(shop.address)), [shops, tag, hidden]);
  const items = useMemo(() => itemsForTag(shops, tag).filter((item) => item.kind !== "house" && !hidden.has(item.shop.address)), [shops, tag, hidden]);

  if (!houses.length && !items.length) {
    return (
      <div className="card mt-8 rounded-3xl p-10 text-center">
        <p className="text-ink/55">No houses or items carry the tag “{tag}” yet.</p>
        <Link href="/tags" className="mt-4 inline-block font-bold text-terracotta">Browse other tags</Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-12">
      {houses.length > 0 && (
        <section>
          <h2 className="display text-2xl">Houses tagged “{tag}” <span className="text-ink/40">· {houses.length}</span></h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {houses.map((shop) => <ShopCard key={shop.id} shop={shop} compact />)}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section>
          <h2 className="display text-2xl">Items tagged “{tag}” <span className="text-ink/40">· {items.length}</span></h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => {
              const isLink = item.kind === "link";
              const Icon = item.kind === "link" ? Link2 : decoIcons[item.kind === "decoration" ? item.decoration.type : "text"];
              const title = item.kind === "link" ? item.link.label : item.kind === "decoration" ? item.decoration.title : "";
              return (
                <Link
                  key={`${item.shop.id}-${index}`}
                  href={`/shop/${item.shop.address}`}
                  className="card group flex items-start gap-3 rounded-2xl p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rosewater text-terracotta"><Icon size={16} /></span>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{title}</p>
                    <p className="truncate text-xs text-ink/50">{isLink ? "Link" : "Decoration"} in {item.shop.name}</p>
                  </div>
                  <ArrowUpRight size={15} className="ml-auto text-ink/30 transition group-hover:text-terracotta" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
