"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Check, Plus } from "lucide-react";
import { useDemo } from "@/components/providers/demo-provider";
import {
  collectionsContaining,
  createCollection,
  ensureSeeded,
  getCollections,
  toggleInCollection,
  type SaveTarget,
} from "@/lib/collections";
import { recordActivity } from "@/lib/activity";
import type { Collection } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SaveButton({ target, variant = "icon", quick = false }: { target: SaveTarget; variant?: "icon" | "pill"; quick?: boolean }) {
  const { user, ownedShop } = useDemo();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [containing, setContaining] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const sync = () => {
    setCollections(getCollections());
    setContaining(new Set(collectionsContaining(target)));
  };

  useEffect(() => {
    const refresh = () => sync();
    refresh();
    window.addEventListener("ai-bazaar-collections-changed", refresh);
    return () => window.removeEventListener("ai-bazaar-collections-changed", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.kind, target.shopAddress, target.itemId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Cards live inside an overflow-hidden container that would clip a popover, so
  // there we quick-toggle the first default collection instead of opening a menu.
  const quickSave = () => {
    const defaults = ensureSeeded();
    const favorites = defaults.find((collection) => collection.isDefault) ?? defaults[0];
    if (favorites) toggle(favorites);
  };

  const handleClick = () => {
    if (quick) {
      quickSave();
      return;
    }
    ensureSeeded();
    sync();
    setOpen((value) => !value);
  };

  const toggle = (collection: Collection) => {
    const nowSaved = toggleInCollection(collection.id, target);
    if (nowSaved) {
      recordActivity({
        type: "saved_to_collection",
        actorName: ownedShop?.owner ?? user?.name ?? "A visitor",
        actorHandle: ownedShop?.ownerHandle ?? "guest",
        summary: `saved ${target.label} to ${collection.name}`,
        href: `/shop/${target.shopAddress}`,
      });
    }
    sync();
  };

  const addCollection = () => {
    const created = createCollection(newName);
    if (created) {
      toggle(created);
      setNewName("");
    }
  };

  const saved = containing.size > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleClick}
        aria-label={saved ? "Saved — edit collections" : "Save to collection"}
        className={cn(
          variant === "icon"
            ? "grid size-10 shrink-0 place-items-center rounded-full border transition"
            : "grid size-11 place-items-center rounded-full border shadow-sm transition hover:scale-105",
          saved ? "border-saffron bg-saffron/15 text-saffron" : "border-ink/10 bg-white text-ink hover:border-saffron",
        )}
      >
        <Bookmark size={variant === "icon" ? 17 : 17} fill={saved ? "currentColor" : "none"} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-ink/10 bg-white p-2 shadow-lift">
          <p className="px-2 py-1.5 text-[11px] font-black uppercase tracking-wider text-ink/40">Save to</p>
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {collections.map((collection) => {
              const isIn = containing.has(collection.id);
              return (
                <li key={collection.id}>
                  <button
                    onClick={() => toggle(collection)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-bold hover:bg-parchment"
                  >
                    <span className="truncate">{collection.name}</span>
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", isIn ? "border-saffron bg-saffron text-white" : "border-ink/20")}>
                      {isIn && <Check size={13} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex items-center gap-1 border-t border-ink/10 pt-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") addCollection(); }}
              placeholder="New collection"
              aria-label="New collection name"
              className="min-w-0 flex-1 rounded-lg border border-ink/10 px-2 py-1.5 text-sm outline-none focus:border-saffron"
            />
            <button onClick={addCollection} disabled={!newName.trim()} aria-label="Create collection" className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-white disabled:opacity-40">
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
