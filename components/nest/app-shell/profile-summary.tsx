"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Pencil, UserRound, X } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";

// Phase 3/4 — the Home profile summary. Shows avatar · username · bio · nest count
// for the signed-in creator, and doubles as the username-ownership surface (claim
// when guest, edit username + bio when signed in). Identity is the nest-auth session
// joined with the local nest-profile store (see useNestIdentity).

export function Avatar({ username, size = 56 }: { username?: string; size?: number }) {
  const initial = username?.trim()?.[0]?.toUpperCase();
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-terracotta font-black text-parchment"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initial ?? <UserRound size={size * 0.5} />}
    </span>
  );
}

export function ProfileSummary({ nestCount }: { nestCount: number }) {
  const { session, profile, loading, signedIn, claimUsername, updateProfile, startLocalIdentity } = useNestIdentity();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string>();

  if (loading) {
    return <div className="h-24 animate-pulse rounded-3xl border border-timber/15 bg-white/60" />;
  }

  // Guest / no identity yet — claim a username right here.
  if (!signedIn) {
    return (
      <div className="rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <Avatar />
          <div>
            <p className="font-black text-ink">Claim your Nest</p>
            <p className="text-xs text-ink/50">Pick a username to own your @handle.</p>
          </div>
        </div>
        <div className="mt-4 flex items-stretch gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-timber/20 bg-parchment px-3">
            <span className="text-sm font-bold text-ink/40">@</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="username"
              aria-label="Username"
              style={{ fontSize: 16 }}
              className="w-full bg-transparent py-2.5 outline-none"
            />
          </div>
          <button
            onClick={() => {
              const r = startLocalIdentity(name);
              if (!r.ok) setError(r.error);
              else setError(undefined);
            }}
            disabled={!name.trim()}
            className="rounded-xl bg-terracotta px-4 text-sm font-bold text-parchment disabled:opacity-50"
          >
            Claim
          </button>
        </div>
        {error ? <p className="mt-2 text-xs font-bold text-terracotta">{error}</p> : null}
      </div>
    );
  }

  const username = profile?.username ?? session?.username ?? "creator";

  if (editing) {
    return (
      <div className="rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-black">Edit profile</p>
          <button onClick={() => { setEditing(false); setError(undefined); }} aria-label="Cancel" className="rounded-lg p-1 text-ink/50 hover:bg-parchment"><X className="size-5" /></button>
        </div>
        <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Username</label>
        <div className="mt-1 flex items-center rounded-xl border border-timber/20 bg-parchment px-3">
          <span className="text-sm font-bold text-ink/40">@</span>
          <input defaultValue={username} onChange={(e) => setName(e.target.value)} aria-label="Username" style={{ fontSize: 16 }} className="w-full bg-transparent py-2.5 outline-none" />
        </div>
        <label className="mt-3 block text-xs font-black uppercase tracking-wider text-ink/45">Bio</label>
        <textarea defaultValue={profile?.bio ?? ""} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A short line about your place…" aria-label="Bio" style={{ fontSize: 16 }} className="mt-1 w-full rounded-xl border border-timber/20 bg-parchment p-3 outline-none" />
        {error ? <p className="mt-2 text-xs font-bold text-terracotta">{error}</p> : null}
        <button
          onClick={() => {
            if (name.trim() && name.trim() !== username) {
              const r = claimUsername(name);
              if (!r.ok) { setError(r.error); return; }
            }
            updateProfile({ bio: bio.trim() || undefined });
            setEditing(false);
            setError(undefined);
          }}
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-parchment"
        >
          <Check className="size-4" /> Save
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <Avatar username={username} />
        <div className="min-w-0 flex-1">
          <Link href={`/@${username}`} className="block truncate font-black text-ink hover:underline">@{username}</Link>
          <p className="truncate text-xs text-ink/50">{profile?.bio ?? "Add a short bio about your place."}</p>
        </div>
        <button onClick={() => { setName(""); setBio(profile?.bio ?? ""); setEditing(true); }} aria-label="Edit profile" className="flex size-9 items-center justify-center rounded-full text-ink/50 hover:bg-parchment">
          <Pencil className="size-4" />
        </button>
      </div>
      <div className="mt-4 flex gap-6 border-t border-timber/10 pt-3">
        <div>
          <p className="text-lg font-black text-ink">{nestCount}</p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink/45">{nestCount === 1 ? "Nest" : "Nests"}</p>
        </div>
        <Link href={`/@${username}`} className="ml-auto self-center text-xs font-bold text-terracotta hover:underline">
          View public profile →
        </Link>
      </div>
    </div>
  );
}
