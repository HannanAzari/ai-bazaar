"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, LogOut, Pencil, UserRound, X } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { AuthPanel } from "@/components/nest/app-shell/auth-panel";
import { formatCount } from "@/lib/nest-engagement";
import { followerCount, followingCount, onSocialChanged } from "@/lib/nest-social";
import type { NestSocials } from "@/lib/nest-profile-store";

// M16 — the Profile dashboard header. States: signed-out (sign up / sign in) →
// signed-in-no-username (claim, immutable) → full summary (avatar · @username · bio ·
// nest count · edit bio+socials · sign out). Identity is the real Nest account.

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

const SOCIAL_FIELDS: { key: keyof NestSocials; label: string; placeholder: string }[] = [
  { key: "website", label: "Website", placeholder: "https://your.site" },
  { key: "github", label: "GitHub", placeholder: "github.com/you" },
  { key: "twitter", label: "Twitter / X", placeholder: "@you" },
  { key: "youtube", label: "YouTube", placeholder: "youtube.com/@you" },
];

export function ProfileSummary({ nestCount }: { nestCount: number }) {
  const { account, profile, loading, signedIn, claimUsername, updateProfile, signOut } = useNestIdentity();
  const [editing, setEditing] = useState(false);
  const [claimName, setClaimName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [socials, setSocials] = useState<NestSocials>({});
  const [error, setError] = useState<string>();
  const [social, setSocial] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    if (!account) return;
    const refresh = () => setSocial({ followers: followerCount(account.id), following: followingCount(account.id) });
    refresh();
    return onSocialChanged(refresh);
  }, [account]);

  if (loading) return <div className="h-24 animate-pulse rounded-3xl border border-timber/15 bg-white/60" />;

  // Signed out → real account sign up / sign in.
  if (!signedIn) {
    return (
      <div className="rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
        <div className="mb-3 flex items-center gap-3">
          <Avatar />
          <div>
            <p className="font-black text-ink">Make this your place</p>
            <p className="text-xs text-ink/50">Sign up to own your Nests across devices.</p>
          </div>
        </div>
        <AuthPanel />
      </div>
    );
  }

  const username = profile?.username;

  // Signed in but no username yet → claim it (immutable).
  if (!username) {
    return (
      <div className="rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <Avatar />
          <div className="min-w-0 flex-1">
            <p className="font-black text-ink">Claim your username</p>
            <p className="truncate text-xs text-ink/50">{account?.email} · pick a permanent @handle.</p>
          </div>
          <SignOutButton onSignOut={signOut} />
        </div>
        <div className="mt-4 flex items-stretch gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-timber/20 bg-parchment px-3">
            <span className="text-sm font-bold text-ink/40">@</span>
            <input value={claimName} onChange={(e) => setClaimName(e.target.value)} placeholder="username" aria-label="Username" style={{ fontSize: 16 }} className="w-full bg-transparent py-2.5 outline-none" />
          </div>
          <button onClick={() => { const r = claimUsername(claimName); setError(r.ok ? undefined : r.error); }} disabled={!claimName.trim()} className="rounded-xl bg-terracotta px-4 text-sm font-bold text-parchment disabled:opacity-50">Claim</button>
        </div>
        <p className="mt-2 text-[11px] text-ink/45">Lowercase, 3–20 chars, letters/numbers/underscore. Permanent for now.</p>
        {error ? <p className="mt-1 text-xs font-bold text-terracotta">{error}</p> : null}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="rounded-3xl border border-timber/15 bg-white p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-black">Edit profile</p>
          <button onClick={() => { setEditing(false); setError(undefined); }} aria-label="Cancel" className="rounded-lg p-1 text-ink/50 hover:bg-parchment"><X className="size-5" /></button>
        </div>
        <p className="mb-3 text-xs text-ink/45">@{username} · <span className="font-bold">permanent</span></p>
        <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Display name</label>
        <input defaultValue={profile?.displayName ?? ""} onChange={(e) => setDisplayName(e.target.value)} aria-label="Display name" style={{ fontSize: 16 }} className="mt-1 w-full rounded-xl border border-timber/20 bg-parchment px-3 py-2.5 outline-none" />
        <label className="mt-3 block text-xs font-black uppercase tracking-wider text-ink/45">Bio</label>
        <textarea defaultValue={profile?.bio ?? ""} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="A short line about your place…" aria-label="Bio" style={{ fontSize: 16 }} className="mt-1 w-full rounded-xl border border-timber/20 bg-parchment p-3 outline-none" />
        <p className="mt-3 text-xs font-black uppercase tracking-wider text-ink/45">Links</p>
        <div className="mt-1 space-y-2">
          {SOCIAL_FIELDS.map((f) => (
            <input key={f.key} defaultValue={profile?.socials?.[f.key] ?? ""} onChange={(e) => setSocials((s) => ({ ...s, [f.key]: e.target.value }))} placeholder={f.placeholder} aria-label={f.label} style={{ fontSize: 16 }} className="w-full rounded-xl border border-timber/20 bg-parchment px-3 py-2 text-sm outline-none" />
          ))}
        </div>
        <button
          onClick={() => {
            updateProfile({
              displayName: displayName.trim() || profile?.displayName,
              bio: bio.trim() || undefined,
              socials: Object.fromEntries(Object.entries(socials).map(([k, v]) => [k, v.trim() || undefined])) as NestSocials,
            });
            setEditing(false);
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
          {profile?.displayName ? <p className="truncate font-black text-ink">{profile.displayName}</p> : null}
          <Link href={`/@${username}`} className={`block truncate hover:underline ${profile?.displayName ? "text-sm text-ink/55" : "font-black text-ink"}`}>@{username}</Link>
          <p className="truncate text-xs text-ink/50">{profile?.bio ?? "Add a short bio about your place."}</p>
        </div>
        <button onClick={() => { setDisplayName(""); setBio(profile?.bio ?? ""); setSocials(profile?.socials ?? {}); setEditing(true); }} aria-label="Edit profile" className="flex size-9 items-center justify-center rounded-full text-ink/50 hover:bg-parchment"><Pencil className="size-4" /></button>
        <SignOutButton onSignOut={signOut} />
      </div>
      <div className="mt-4 flex items-center gap-5 border-t border-timber/10 pt-3">
        <Stat value={social.followers} label="Followers" />
        <Stat value={social.following} label="Following" />
        <Stat value={nestCount} label={nestCount === 1 ? "Nest" : "Nests"} />
        <Link href={`/@${username}`} className="ml-auto self-center text-xs font-bold text-terracotta hover:underline">Public →</Link>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-lg font-black leading-none text-ink">{formatCount(value)}</p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/45">{label}</p>
    </div>
  );
}

function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <button onClick={onSignOut} aria-label="Sign out" className="flex size-9 items-center justify-center rounded-full text-ink/50 hover:bg-parchment">
      <LogOut className="size-4" />
    </button>
  );
}
