"use client";

import { useEffect, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { addComment, deleteComment, listComments, onSocialChanged, type NestComment } from "@/lib/nest-social";
import { resolvePublishedBySlug } from "@/lib/nest-document-store";
import { getNestProfile } from "@/lib/nest-profile-store";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { BottomSheet } from "@/components/nest/social/bottom-sheet";
import { AuthGateSheet } from "@/components/nest/social/auth-gate-sheet";

// M18 — comments as a slide-up sheet (Instagram/TikTok feel), not a forum page. Newest
// first, creator badge beside the owner's own comments, delete your own, auth required to
// post. No replies/reactions/threads.
export function CommentSheet({ nestId, open, onClose }: { nestId: string; open: boolean; onClose: () => void }) {
  const { ownerId } = useNestIdentity();
  const [comments, setComments] = useState<NestComment[]>([]);
  const [body, setBody] = useState("");
  const [gate, setGate] = useState(false);
  const creatorId = resolvePublishedBySlug(nestId)?.ref.ownerId;

  useEffect(() => {
    if (!open) return;
    const refresh = () => setComments(listComments(nestId));
    refresh();
    return onSocialChanged(refresh);
  }, [nestId, open]);

  function submit() {
    if (!ownerId) { setGate(true); return; }
    if (addComment(nestId, ownerId, body)) setBody("");
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Comments${comments.length ? ` · ${comments.length}` : ""}`}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3" style={{ minHeight: "38dvh" }}>
          {comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink/45">No comments yet — be the first to say hello.</p>
          ) : (
            comments.map((c) => <CommentRow key={c.id} comment={c} isCreator={c.userId === creatorId} canDelete={c.userId === ownerId} />)
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-timber/15 px-3 py-2.5">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            onFocus={() => { if (!ownerId) setGate(true); }}
            placeholder="Add a comment…"
            aria-label="Add a comment"
            style={{ fontSize: 16 }}
            className="min-w-0 flex-1 rounded-full border border-timber/20 bg-white px-4 py-2.5 outline-none"
          />
          <button onClick={submit} disabled={!body.trim()} aria-label="Post comment" className="grid size-10 shrink-0 place-items-center rounded-full bg-terracotta text-parchment disabled:opacity-40">
            <Send className="size-4" />
          </button>
        </div>
      </div>
      <AuthGateSheet open={gate} onClose={() => setGate(false)} action="comment" />
    </BottomSheet>
  );
}

function CommentRow({ comment, isCreator, canDelete }: { comment: NestComment; isCreator: boolean; canDelete: boolean }) {
  const profile = getNestProfile(comment.userId);
  const name = profile?.username ? `@${profile.username}` : profile?.displayName ?? "Someone";
  const initial = (profile?.username ?? profile?.displayName ?? "N").charAt(0).toUpperCase();
  return (
    <div className="flex gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-terracotta text-xs font-black text-parchment">{initial}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm">
          <span className="font-black text-ink">{name}</span>
          {isCreator ? <span className="rounded-full bg-terracotta/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-terracotta">Creator</span> : null}
          <span className="text-[11px] text-ink/40">{timeAgo(comment.createdAt)}</span>
        </p>
        <p className="mt-0.5 break-words text-sm text-ink/80">{comment.body}</p>
      </div>
      {canDelete ? (
        <button onClick={() => deleteComment(comment.id, comment.userId)} aria-label="Delete comment" className="shrink-0 self-start rounded-lg p-1 text-ink/35 hover:text-terracotta">
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
