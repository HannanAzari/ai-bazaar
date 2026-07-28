"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, LogOut, MoreHorizontal, Trash2, UserRound, X } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { AuthPanel } from "@/components/nest/app-shell/auth-panel";
import { formatCount } from "@/lib/nest-engagement";
import { followerCount, followingCount, onSocialChanged } from "@/lib/nest-social";
import { deleteAvatar, getActiveAvatar, type UserAvatar } from "@/lib/avatar-factory/avatar-repo";
import type { NestSocials } from "@/lib/nest-profile-store";

// M16 — the Profile dashboard header. States: signed-out (sign up / sign in) →
// signed-in-no-username (claim, immutable) → full summary (avatar · @username · bio ·
// nest count · edit bio+socials · sign out). Identity is the real Nest account.

export function Avatar({ username, size = 56, src }: { username?: string; size?: number; src?: string | null }) {
  const initial = username?.trim()?.[0]?.toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user avatar from Supabase; next/image adds no value here
      <img
        src={src}
        alt={username ? `${username}'s avatar` : "avatar"}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, background: "#f4f4f4" }}
      />
    );
  }
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
            <p className="font-black text-ink">Make this your Nest</p>
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
      <div className="rounded-3xl border border-timber/15 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Avatar size={48} />
          <div className="min-w-0 flex-1">
            <p className="font-black text-ink">Claim your username</p>
            <p className="truncate text-xs text-ink/50">{account?.email} · pick a permanent @handle.</p>
          </div>
          <OverflowMenu onSignOut={signOut} />
        </div>
        <div className="mt-3 flex items-stretch gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-timber/20 bg-parchment px-3">
            <span className="text-sm font-bold text-ink/40">@</span>
            <input value={claimName} onChange={(e) => setClaimName(e.target.value)} placeholder="username" aria-label="Username" style={{ fontSize: 16 }} className="w-full bg-transparent py-2.5 outline-none" />
          </div>
          <button onClick={() => { const r = claimUsername(claimName); setError(r.ok ? undefined : r.error); }} disabled={!claimName.trim()} className="rounded-xl bg-terracotta px-4 text-sm font-bold text-parchment disabled:opacity-50">Claim</button>
        </div>
        <p className="mt-2 text-[11px] text-ink/45">Lowercase, 3–20 characters (letters, numbers, underscore). This becomes your permanent @handle.</p>
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
        <textarea defaultValue={profile?.bio ?? ""} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="A short line about your Nest…" aria-label="Bio" style={{ fontSize: 16 }} className="mt-1 w-full rounded-xl border border-timber/20 bg-parchment p-3 outline-none" />
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

  // Compact identity: tapping the CARD edits; tapping the AVATAR opens photo actions;
  // account actions (sign out) live in the ☰ overflow. One question: "who am I?".
  const openEditor = () => { setDisplayName(""); setBio(profile?.bio ?? ""); setSocials(profile?.socials ?? {}); setEditing(true); };

  return (
    <div className="rounded-3xl border border-timber/15 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-3.5">
        <AvatarButton username={username} src={profile?.avatarUrl} />
        {/* The card body is the edit affordance — no hunting for a pencil. */}
        {/* Spans, not <p>: a <button> may only contain phrasing content. */}
        <button onClick={openEditor} className="min-w-0 flex-1 text-left" aria-label="Edit profile">
          {profile?.displayName ? <span className="block truncate text-[17px] font-black leading-tight text-ink">{profile.displayName}</span> : null}
          <span className={`block truncate ${profile?.displayName ? "text-[13px] text-ink/55" : "text-[17px] font-black text-ink"}`}>@{username}</span>
          <span className="block truncate text-xs text-ink/50">{profile?.bio ?? "Add a short bio"}</span>
        </button>
        <OverflowMenu onSignOut={signOut} />
      </div>
      <div className="mt-3 flex items-center gap-5 border-t border-timber/10 pt-2.5">
        <Stat value={social.followers} label="Followers" />
        <Stat value={social.following} label="Following" />
        <Stat value={nestCount} label={nestCount === 1 ? "Nest" : "Nests"} />
        <Link href={`/@${username}`} className="ml-auto self-center text-xs font-bold text-terracotta hover:underline">View public profile</Link>
      </div>
    </div>
  );
}

// The profile photo IS the entry point to avatar actions (modern mobile pattern) — no
// separate avatar card. Owner-only: Create / Change / Remove.
function AvatarButton({ username, src }: { username?: string; src?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<UserAvatar | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => { setActive(await getActiveAvatar()); }, []);
  useEffect(() => { void load(); }, [load]);

  // Dismiss on outside tap / Escape — sheet-like behaviour without a new component.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const remove = async () => {
    if (!active) return;
    setBusy(true); setError(null);
    const res = await deleteAvatar(active.id);
    setBusy(false);
    if (!res.ok) { setError(res.error || "Could not remove the avatar."); return; }
    setOpen(false);
    await load();
    router.refresh();
  };

  const photo = src ?? active?.publicProfileUrl ?? null;

  return (
    <div ref={wrap} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} aria-label="Change profile photo" aria-expanded={open} className="relative block rounded-full active:scale-95">
        <Avatar username={username} src={photo} size={60} />
        <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-white bg-ink text-parchment">
          <Camera className="size-3" />
        </span>
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-timber/15 bg-white shadow-lift">
          <Link href="/profile/avatar" role="menuitem" className="flex items-center gap-2 px-3.5 py-3 text-sm font-bold text-ink hover:bg-parchment">
            <Camera className="size-4 text-terracotta" /> {active ? "Change avatar" : "Create avatar"}
          </Link>
          {active ? (
            <button onClick={remove} disabled={busy} role="menuitem" className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              <Trash2 className="size-4" /> {busy ? "Removing…" : "Remove avatar"}
            </button>
          ) : null}
          {error ? <p className="px-3.5 pb-2.5 text-[11px] text-rose-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-base font-black leading-none text-ink">{formatCount(value)}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-ink/45">{label}</p>
    </div>
  );
}

// Account actions live here so the identity card stays about identity.
function OverflowMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={wrap} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account options" aria-expanded={open} className="flex size-9 items-center justify-center rounded-full text-ink/45 hover:bg-parchment">
        <MoreHorizontal className="size-5" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-2xl border border-timber/15 bg-white shadow-lift">
          <button onClick={onSignOut} role="menuitem" className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm font-bold text-ink hover:bg-parchment">
            <LogOut className="size-4 text-ink/50" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
