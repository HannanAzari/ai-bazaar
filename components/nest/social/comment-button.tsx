"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { formatCount } from "@/lib/nest-engagement";
import { CommentSheet } from "@/components/nest/social/comment-sheet";
import { useNestSocial } from "@/components/nest/social/use-nest-social";

// M18 → M23B — opens comments as a slide-up sheet (no navigation away) and shows the
// live count from the shared `nest_comments` table. The sheet calls `refresh` after it
// posts or deletes, so the rail's count always matches what the sheet is showing.
export function CommentButton({
  nestId,
  tone = "ink",
  ownerId,
  nestTitle,
}: {
  nestId: string;
  tone?: "ink" | "light";
  ownerId?: string;
  nestTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const { commentCount, refresh } = useNestSocial(nestId, ownerId, nestTitle);

  const light = tone === "light";
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Comments"
        className={`flex items-center gap-1.5 text-sm font-bold transition active:scale-95 ${light ? "text-white" : "text-ink/70"}`}
      >
        <MessageCircle className="size-5" /> {formatCount(commentCount)}
      </button>
      <CommentSheet
        nestId={nestId}
        open={open}
        onClose={() => setOpen(false)}
        nestOwnerId={ownerId}
        nestTitle={nestTitle}
        onChanged={refresh}
      />
    </>
  );
}
