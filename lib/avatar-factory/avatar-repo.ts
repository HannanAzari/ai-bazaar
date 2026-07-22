"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Client-side reader for the signed-in user's OWN avatars. RLS (owner-only) means these
// queries can only ever return the caller's rows — no owner filter is needed or trusted
// client-side; the database enforces isolation. Used by the profile avatar section and the
// editor "My Avatar" category.

export type UserAvatar = {
  id: string;
  title: string | null;
  publicProfileUrl: string | null;
  editorAssetUrl: string | null;
  active: boolean;
  pose: string;
  status: string;
  createdAt: string;
};

type Row = {
  id: string; title: string | null; public_profile_url: string | null; editor_asset_url: string | null;
  active: boolean; pose: string; status: string; created_at: string;
};

const map = (r: Row): UserAvatar => ({
  id: r.id, title: r.title, publicProfileUrl: r.public_profile_url, editorAssetUrl: r.editor_asset_url,
  active: r.active, pose: r.pose, status: r.status, createdAt: r.created_at,
});

/** All of the signed-in user's non-deleted avatars, newest first (version history). */
export async function listMyAvatars(): Promise<UserAvatar[]> {
  const sb = createSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("user_avatars")
    .select("id,title,public_profile_url,editor_asset_url,active,pose,status,created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Row[]).map(map);
}

/** The signed-in user's single active avatar (or null). */
export async function getActiveAvatar(): Promise<UserAvatar | null> {
  const avatars = await listMyAvatars();
  return avatars.find((a) => a.active) ?? null;
}

/** Delete/revoke an avatar via the server route (owner-enforced). */
export async function deleteAvatar(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/avatar/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const j = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: j.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
