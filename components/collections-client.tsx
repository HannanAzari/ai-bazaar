"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, FolderPlus, Sparkles, X } from "lucide-react";
import { useAllShops } from "@/components/providers/demo-provider";
import { ShopCard } from "@/components/shop-card";
import { createCollection, ensureSeeded, getCollections, getItems, removeItem } from "@/lib/collections";
import type { Collection, CollectionItem, Shop } from "@/lib/types";

export function CollectionsClient() {
  const shops = useAllShops();
  const byAddress = useMemo(() => new Map(shops.map((shop) => [shop.address, shop] as const)), [shops]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [itemsByCol, setItemsByCol] = useState<Record<string, CollectionItem[]>>({});
  const [newName, setNewName] = useState("");

  const sync = () => {
    const cols = getCollections();
    setCollections(cols);
    setItemsByCol(Object.fromEntries(cols.map((col) => [col.id, getItems(col.id)])));
  };

  useEffect(() => {
    ensureSeeded();
    sync();
    window.addEventListener("ai-bazaar-collections-changed", sync);
    return () => window.removeEventListener("ai-bazaar-collections-changed", sync);
  }, []);

  const add = () => {
    if (createCollection(newName)) setNewName("");
  };

  return (
    <div className="mt-8 space-y-10">
      {/* Create */}
      <div className="flex max-w-md items-center gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") add(); }}
          placeholder="New collection name"
          aria-label="New collection name"
          className="min-h-11 flex-1 rounded-xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-saffron"
        />
        <button onClick={add} disabled={!newName.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40">
          <FolderPlus size={16} /> Create
        </button>
      </div>

      {collections.map((collection) => {
        const items = itemsByCol[collection.id] ?? [];
        const houses = items.filter((item) => item.kind === "house");
        const others = items.filter((item) => item.kind !== "house");
        return (
          <section key={collection.id}>
            <div className="mb-4 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-saffron/15 text-saffron"><Bookmark size={17} /></span>
              <h2 className="display text-2xl">{collection.name}</h2>
              <span className="text-sm text-ink/40">· {items.length}</span>
            </div>

            {items.length === 0 ? (
              <p className="card rounded-2xl p-6 text-sm text-ink/50">Nothing saved here yet. Tap the bookmark on any house to add it.</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {houses.map((item) => {
                  const shop = byAddress.get(item.shopAddress) as Shop | undefined;
                  return shop ? (
                    <div key={item.id} className="relative">
                      <ShopCard shop={shop} compact />
                      <button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.label}`} className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-white/90 text-ink shadow-soft hover:bg-terracotta hover:text-white">
                        <X size={15} />
                      </button>
                    </div>
                  ) : null;
                })}
                {others.map((item) => (
                  <Link key={item.id} href={`/shop/${item.shopAddress}`} className="card group flex items-start gap-3 rounded-2xl p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rosewater text-terracotta"><Sparkles size={16} /></span>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{item.label}</p>
                      <p className="truncate text-xs text-ink/50">Item · {item.shopAddress}</p>
                    </div>
                    <button onClick={(event) => { event.preventDefault(); removeItem(item.id); }} aria-label={`Remove ${item.label}`} className="ml-auto grid size-7 place-items-center rounded-full text-ink/40 hover:text-terracotta">
                      <X size={14} />
                    </button>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
