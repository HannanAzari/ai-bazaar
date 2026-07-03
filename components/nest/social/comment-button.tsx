"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { commentCount, onSocialChanged } from "@/lib/nest-social";
import { formatCount } from "@/lib/nest-engagement";
import { CommentSheet } from "@/components/nest/social/comment-sheet";

// M18 — opens comments as a slide-up sheet (no navigation away). Shows the live count.
export function CommentButton({ nestId, tone = "ink" }: { nestId: string; tone?: "ink" | "light" }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(commentCount(nestId));
    refresh();
    return onSocialChanged(refresh);
  }, [nestId]);

  const light = tone === "light";
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Comments" className={`flex items-center gap-1.5 text-sm font-bold transition active:scale-95 ${light ? "text-white" : "text-ink/70"}`}>
        <MessageCircle className="size-5" /> {formatCount(count)}
      </button>
      <CommentSheet nestId={nestId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
