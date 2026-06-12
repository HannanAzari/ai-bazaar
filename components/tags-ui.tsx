"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Hash, X } from "lucide-react";
import { normalizeTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

/** Read-only tag chips that link through to each tag's page. */
export function TagChips({ tags, size = "sm", className }: { tags: string[]; size?: "sm" | "md"; className?: string }) {
  if (!tags.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={`/tags/${tag}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-timber/20 bg-parchment/80 font-bold text-ink-soft transition hover:border-terracotta hover:bg-terracotta/10 hover:text-terracotta",
            size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-sm",
          )}
        >
          <Hash size={size === "sm" ? 11 : 13} className="opacity-50" />
          {tag}
        </Link>
      ))}
    </div>
  );
}

/** Editable tag list: chips with remove, plus an input that parses on enter/comma. */
export function TagInput({ value, onChange, placeholder = "Add a tag…" }: { value: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tag = normalizeTag(draft);
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-ink/10 bg-white px-2 py-2">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-1 text-[11px] font-bold text-terracotta">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} className="grid place-items-center rounded-full hover:bg-terracotta/20">
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        aria-label="Add a tag"
        className="min-w-[7ch] flex-1 bg-transparent px-1 text-sm outline-none"
      />
    </div>
  );
}
