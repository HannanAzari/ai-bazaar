"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { BottomSheet } from "@/components/nest/social/bottom-sheet";
import { AuthGateSheet } from "@/components/nest/social/auth-gate-sheet";
import { nestBackend } from "@/lib/nest-repo";
import * as social from "@/lib/nest/supabase-social-repo";
import { getProfiles, type CreatorProfile } from "@/lib/nest/supabase-profile-repo";
import {
  addComment as localAdd,
  deleteComment as localDelete,
  listComments as localList,
  onSocialChanged,
} from "@/lib/nest-social";
import { getNestProfile } from "@/lib/nest-profile-store";
import * as store from "@/lib/nest-social-store";

// M18 → M23B — comments as a slide-up sheet (Instagram/TikTok feel), not a forum page.
// Newest first, creator badge beside the owner's own comments, delete your own, auth
// required to post. No replies, no threads, no reactions — none of those exist today and
// this sprint does not add them.
//
// All four states the sprint asks for are real here: loading, empty, error, and list.

type Row = { id: string; userId: string; body: string; createdAt: string };

const isSupabase = () => nestBackend() === "supabase";

export function CommentSheet({
  nestId,
  open,
  onClose,
  nestOwnerId,
  nestTitle,
  onChanged,
}: {
  nestId: string;
  open: boolean;
  onClose: () => void;
  nestOwnerId?: string;
  nestTitle?: string;
  onChanged?: () => void;
}) {
  const { ownerId } = useNestIdentity();
  const [rows, setRows] = useState<Row[]>([]);
  const [authors, setAuthors] = useState<Map<string, CreatorProfile>>(new Map());
  const [body, setBody] = useState("");
  const [gate, setGate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabase()) {
      setRows(localList(nestId).map((c) => ({ id: c.id, userId: c.userId, body: c.body, createdAt: c.createdAt })));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await social.listComments(nestId);
      setRows(list.map((c) => ({ id: c.id, userId: c.userId, body: c.body, createdAt: c.createdAt })));
      // Resolve every commenter in one query so the sheet shows real @handles.
      setAuthors(await getProfiles(list.map((c) => c.userId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comments could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [nestId]);

  useEffect(() => {
    if (!open) return;
    void load();
    if (!isSupabase()) return onSocialChanged(() => void load());
  }, [open, load]);

  const submit = async () => {
    if (!ownerId) { setGate(true); return; }
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setError(null);
    try {
      if (isSupabase()) await social.addComment(nestId, ownerId, text, nestOwnerId, nestTitle);
      else localAdd(nestId, ownerId, text);
      setBody("");
      // M24 §8 — the count moves everywhere immediately (Home card, full-Nest rail),
      // not just in this sheet after a refetch.
      store.applyCommentDelta(nestId, 1);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your comment could not be posted.");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    if (!ownerId) return;
    try {
      if (isSupabase()) await social.deleteComment(id, ownerId);
      else localDelete(id, ownerId);
      store.applyCommentDelta(nestId, -1);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your comment could not be deleted.");
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Comments${rows.length ? ` · ${rows.length}` : ""}`}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3" style={{ minHeight: "38dvh" }}>
          {loading && rows.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-ink/45">
              <Loader2 className="size-4 animate-spin" /> Loading comments…
            </p>
          ) : error && rows.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-bold text-terracotta">Comments couldn&rsquo;t load.</p>
              <p className="mx-auto mt-1 max-w-[15rem] text-xs text-ink/45">{error}</p>
              <button onClick={() => void load()} className="mt-3 min-h-[40px] rounded-full border border-timber/20 px-4 text-xs font-black text-ink/70">
                Try again
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink/45">No comments yet — be the first to say hello.</p>
          ) : (
            rows.map((c) => (
              <CommentRow
                key={c.id}
                row={c}
                author={authors.get(c.userId)}
                isCreator={!!nestOwnerId && c.userId === nestOwnerId}
                canDelete={c.userId === ownerId}
                onDelete={() => void remove(c.id)}
              />
            ))
          )}
        </div>

        {error && rows.length > 0 ? (
          <p role="alert" className="px-4 pb-1 text-[11px] font-bold text-terracotta">{error}</p>
        ) : null}

        <div className="flex items-center gap-2 border-t border-timber/15 px-3 py-2.5">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            onFocus={() => { if (!ownerId) setGate(true); }}
            placeholder="Add a comment…"
            aria-label="Add a comment"
            maxLength={500}
            style={{ fontSize: 16 }}
            className="min-w-0 flex-1 rounded-full border border-timber/20 bg-white px-4 py-2.5 outline-none"
          />
          <button
            onClick={() => void submit()}
            disabled={!body.trim() || posting}
            aria-label="Post comment"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-terracotta text-parchment disabled:opacity-40"
          >
            {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
      <AuthGateSheet open={gate} onClose={() => setGate(false)} action="comment" />
    </BottomSheet>
  );
}

function CommentRow({
  row,
  author,
  isCreator,
  canDelete,
  onDelete,
}: {
  row: Row;
  author?: CreatorProfile;
  isCreator: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  // Server profile first; the local store is only consulted on the demo backend.
  const local = isSupabase() ? null : getNestProfile(row.userId);
  const username = author?.username ?? local?.username;
  const displayName = author?.displayName ?? local?.displayName;
  const name = username ? `@${username}` : displayName ?? "Someone";
  const initial = (username ?? displayName ?? "N").charAt(0).toUpperCase();

  return (
    <div className="flex gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-terracotta text-xs font-black text-parchment">{initial}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm">
          <span className="font-black text-ink">{name}</span>
          {isCreator ? (
            <span className="rounded-full bg-terracotta/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-terracotta">Creator</span>
          ) : null}
          <span className="text-[11px] text-ink/40">{timeAgo(row.createdAt)}</span>
        </p>
        <p className="mt-0.5 break-words text-sm text-ink/80">{row.body}</p>
      </div>
      {canDelete ? (
        <button onClick={onDelete} aria-label="Delete comment" className="shrink-0 self-start rounded-lg p-1 text-ink/35 hover:text-terracotta">
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
