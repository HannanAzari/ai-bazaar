"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { deleteAvatar, listMyAvatars, type UserAvatar } from "@/lib/avatar-factory/avatar-repo";

// Profile → Avatar section. States: no avatar → Create; existing → Replace / History /
// Remove. Reads the signed-in user's own user_avatars (RLS owner-only). Removal calls the
// server delete route (revokes source + outputs + profile reference). Does not touch any
// other profile field.

export function AvatarManager() {
  const { signedIn } = useNestIdentity();
  const [avatars, setAvatars] = useState<UserAvatar[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => { setAvatars(await listMyAvatars()); }, []);
  useEffect(() => { if (signedIn) void load(); }, [signedIn, load]);

  if (!signedIn) return null;

  const active = avatars?.find((a) => a.active) ?? null;
  const history = (avatars ?? []).filter((a) => !a.active);

  const remove = async () => {
    if (!active) return;
    setBusy(true); setError(null);
    const res = await deleteAvatar(active.id);
    setBusy(false); setConfirming(false);
    if (!res.ok) { setError(res.error || "Could not remove the avatar."); return; }
    await load();
  };

  return (
    <section className="rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-ink">Avatar</h2>
        {avatars === null && <span className="text-[11px] text-ink/40">loading…</span>}
      </div>

      {error && <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">{error}</p>}

      {avatars !== null && !active && (
        <div className="mt-3 flex items-center gap-3">
          <p className="flex-1 text-xs text-ink/55">Create a full-body Nestudio avatar from a photo. Private to you.</p>
          <Link href="/profile/avatar" className="rounded-xl bg-terracotta px-4 py-2.5 text-sm font-bold text-parchment">Create Avatar</Link>
        </div>
      )}

      {active && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.publicProfileUrl ?? undefined} alt="Active avatar" className="h-16 w-16 rounded-2xl object-cover" style={{ background: "#f4f4f4" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{active.title ?? "My Avatar"}</p>
              <p className="text-[11px] text-ink/50">Active · {active.pose}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/profile/avatar" className="rounded-xl bg-ink px-3 py-2 text-xs font-bold text-parchment">Replace Avatar</Link>
            {history.length > 0 && (
              <button onClick={() => setShowHistory((s) => !s)} className="rounded-xl border border-timber/20 px-3 py-2 text-xs font-bold text-ink/70">{showHistory ? "Hide history" : `View history (${history.length})`}</button>
            )}
            <button onClick={() => setConfirming(true)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600">Remove Avatar</button>
          </div>

          {showHistory && history.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pt-1">
              {history.map((a) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={a.id} src={a.publicProfileUrl ?? a.editorAssetUrl ?? undefined} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover opacity-70" style={{ background: "#f4f4f4" }} />
              ))}
            </div>
          )}

          {confirming && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-semibold text-rose-800">Remove your avatar? This deletes the source photo and generated files, and clears it from your profile.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={remove} disabled={busy} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "Removing…" : "Yes, remove"}</button>
                <button onClick={() => setConfirming(false)} className="rounded-xl border border-timber/20 px-3 py-2 text-xs font-bold text-ink/70">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
