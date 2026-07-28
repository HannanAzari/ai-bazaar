"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Pencil, Plus, Settings, Trash2, TriangleAlert } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { NestudioStudio } from "@/components/nest/app-shell/nestudio-studio";
import { IdentityBox } from "@/components/nest/profile/identity-box";
import { HouseScene } from "@/components/nest/profile/house-scene";
import { TopControls } from "@/components/nest/profile/top-controls";
import { BottomSheet } from "@/components/nest/social/bottom-sheet";
import { CenteredModal } from "@/components/nest/profile/modal";
import { NestPreview } from "@/components/nest/app-shell/nest-preview";
import { AuthPanel } from "@/components/nest/app-shell/auth-panel";
import { Avatar } from "@/components/nest/app-shell/profile-summary";
import { deriveHouse } from "@/lib/nest-house";
import { SettingsSheet } from "@/components/nest/profile/settings-sheet";
import { useCreatorNests, type CreatorNest } from "@/components/nest/profile/use-creator-nests";
import { resolveTemplate } from "@/lib/nest-production-library";
import { followerCount, onSocialChanged, viewsForOwner } from "@/lib/nest-social";
import { profileLinks } from "@/lib/profile-links";
import { deleteAvatar, getActiveAvatar, type UserAvatar } from "@/lib/avatar-factory/avatar-repo";
import type { NestSocials, ProfileLink } from "@/lib/nest-profile-store";

// Day 3.3 — the creator's own Profile uses the SAME structure as the public one
// (top controls → compact identity box → House scene) so they are one product. The only
// differences are the actions: no Follow, discreet owner editing, and an editable Nest list
// instead of the public "Enter Nests" button.

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Public", unlisted: "Unlisted", followers: "Followers", private: "Private",
};

export function ProfileDashboardClient() {
  const router = useRouter();
  const { ownerId, signedIn, loading, profile, profileError, needsOnboarding, updateProfile } = useNestIdentity();
  const { drafts, published, loading: nestsLoading, error: nestsError } = useCreatorNests(ownerId, { includeDrafts: true });
  const [followers, setFollowers] = useState(0);
  const [views, setViews] = useState(0);
  const [editing, setEditing] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // M23B §1 — a signed-in creator who has not finished onboarding is sent to finish it,
  // rather than being shown a Profile with no name, handle or house.
  useEffect(() => {
    if (!loading && signedIn && needsOnboarding) router.replace("/onboarding");
  }, [loading, signedIn, needsOnboarding, router]);

  useEffect(() => {
    if (!ownerId) return;
    const refresh = () => { setFollowers(followerCount(ownerId)); setViews(viewsForOwner(ownerId)); };
    refresh();
    return onSocialChanged(refresh);
  }, [ownerId]);

  const house = useMemo(() => {
    if (!profile?.username) return null;
    const newest = published[0];
    const tpl = newest?.doc.sourceTemplateId ? resolveTemplate(newest.doc.sourceTemplateId) : undefined;
    return deriveHouse({
      creator: { id: profile.userId, username: profile.username, displayName: profile.displayName },
      // The house the creator CHOSE in onboarding — persona is only the fallback.
      houseStyle: profile.houseStyle,
      persona: tpl?.persona,
      bio: profile.bio,
    });
  }, [profile, published]);

  // Signed out / no handle yet — the account gates come first; the arrival needs a handle.
  if (!signedIn) {
    return (
      <div className="pt-2">
        <div className="rounded-2xl border border-timber/15 bg-white p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-3">
            <Avatar />
            <div>
              <p className="font-black text-ink">Make this your Nest</p>
              <p className="text-xs text-ink/50">Sign up to own your Nests across devices.</p>
            </div>
          </div>
          <AuthPanel />
        </div>
      </div>
    );
  }

  // A profile that FAILED to load is not a profile that is missing. Saying so keeps a
  // configured creator from being pushed back through onboarding by an outage (D-10).
  if (profileError) {
    return (
      <div className="pt-2">
        <div className="rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-soft">
          <TriangleAlert className="mx-auto size-6 text-rose-600" />
          <p className="mt-2 font-black text-ink">We couldn&rsquo;t load your profile</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-ink/55">{profileError}</p>
          <button onClick={() => window.location.reload()} className="mt-3 min-h-[44px] rounded-xl bg-terracotta px-5 text-sm font-bold text-parchment">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Onboarding is in flight (the effect above is redirecting) — render nothing rather
  // than a half-built Profile.
  if (!profile?.username) return null;

  return (
    <div className="flex min-h-full flex-col gap-2.5 pb-2">
      <TopControls
        onBack={() => history.back()}
        backLabel="Back"
        action={
          // §2 — the gear exists only on your OWN Profile. On a visitor's view of this
          // creator it is not hidden with CSS; it is simply never rendered.
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="grid size-9 place-items-center rounded-full border border-timber/20 bg-white text-ink/60 active:scale-95"
          >
            <Settings className="size-4" />
          </button>
        }
      />

      <IdentityBox
        username={profile.username}
        displayName={profile.displayName}
        bio={profile.bio}
        avatarUrl={profile.avatarUrl}
        followers={followers}
        nests={published.length}
        views={views}
        links={profileLinks(profile)}
        onAvatarClick={() => setAvatarOpen(true)}
        avatarLabel="Change your profile photo"
        action={
          <button
            onClick={() => setEditing(true)}
            aria-label="Edit profile"
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-timber/20 px-3 text-xs font-bold text-ink/70 active:scale-95"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
        }
      />

      {/* the same House the public sees — how visitors arrive */}
      {house ? (
        <HouseScene
          house={house}
          className="min-h-[164px] shrink-0"
        />
      ) : null}

      {/* the creator's Nests — editable, compact, no identity repeated */}
      <NestList drafts={drafts} published={published} loading={nestsLoading} error={nestsError} />

      <div className="mt-2">
        <NestudioStudio />
      </div>

      <EditIdentitySheet
        open={editing}
        onClose={() => setEditing(false)}
        displayName={profile.displayName}
        bio={profile.bio}
        socials={profile.socials}
        links={profile.links}
        onSave={(patch) => {
          // legacy fixed socials were migrated into `links` rows — clear them so a link is
          // stored in exactly one place (profileLinks() also de-dupes defensively).
          updateProfile({ ...patch, socials: { website: undefined, github: undefined, twitter: undefined, youtube: undefined } });
          setEditing(false);
        }}
      />
      <AvatarModal open={avatarOpen} onClose={() => setAvatarOpen(false)} username={profile.username} avatarUrl={profile.avatarUrl} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

// ── Nest list ────────────────────────────────────────────────────────────────
// Compact rows, not oversized cards. Draft and Published are visually distinct. Creating
// happens through the existing global Create tab — no extra Create buttons here.
function NestList({
  drafts,
  published,
  loading,
  error,
}: {
  drafts: CreatorNest[];
  published: CreatorNest[];
  loading: boolean;
  error: string | null;
}) {
  const items = [...drafts, ...published].map((n) => ({
    key: n.key,
    doc: n.doc,
    href: n.editHref,
    label: n.isDraft ? "Draft" : VISIBILITY_LABEL[n.visibility] ?? n.visibility,
    draft: n.isDraft,
  }));

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-timber/25 bg-white/60 px-4 py-5 text-sm text-ink/45">
        <Loader2 className="size-4 animate-spin" /> Loading your Nests…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white px-4 py-4 text-center">
        <p className="text-sm font-black text-rose-700">Your Nests couldn&rsquo;t load</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-ink/55">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-timber/25 bg-white/60 px-4 py-5 text-center">
        <p className="text-sm font-black text-ink">No Nests yet</p>
        <p className="mt-0.5 text-xs text-ink/50">Use Create to make your first one.</p>
      </div>
    );
  }

  return (
    <section aria-label="Your Nests" className="space-y-1.5">
      <h2 className="px-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/40">Your Nests</h2>
      {items.map((it) => (
        <div key={it.key} className="flex items-center gap-3 rounded-2xl border border-timber/15 bg-white/90 p-2 shadow-soft">
          <Link href={it.href} className="flex min-w-0 flex-1 items-center gap-3">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-timber/10">
              <NestPreview doc={it.doc} className="h-full w-full" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-ink">{it.doc.title}</span>
              <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${it.draft ? "bg-ink/8 text-ink/60" : "bg-[#4d7358] text-white"}`}>
                {it.label}
              </span>
            </span>
          </Link>
          <span className="shrink-0 pr-1 text-[11px] font-bold text-ink/45">Edit →</span>
        </div>
      ))}
    </section>
  );
}

// ── Owner editing — a focused sheet, never an inline form ────────────────────

function EditIdentitySheet({
  open, onClose, displayName, bio, socials, links, onSave,
}: {
  open: boolean; onClose: () => void;
  displayName?: string; bio?: string; socials?: NestSocials; links?: ProfileLink[];
  onSave: (patch: { displayName?: string; bio?: string; links?: ProfileLink[] }) => void;
}) {
  const [name, setName] = useState("");
  const [b, setB] = useState("");
  const [rows, setRows] = useState<ProfileLink[]>([]);

  // Re-seed on open. Legacy fixed socials are migrated into the unlimited-rows model so a
  // creator's existing four links keep working and become editable/removable like any other.
  useEffect(() => {
    if (!open) return;
    setName(displayName ?? "");
    setB(bio ?? "");
    const legacy: ProfileLink[] = [];
    if (socials?.website) legacy.push({ label: "Website", url: socials.website });
    if (socials?.github) legacy.push({ label: "GitHub", url: socials.github });
    if (socials?.twitter) legacy.push({ label: "Twitter", url: socials.twitter });
    if (socials?.youtube) legacy.push({ label: "YouTube", url: socials.youtube });
    const custom = links ?? [];
    setRows([...legacy, ...custom].length ? [...legacy, ...custom] : [{ label: "", url: "" }]);
  }, [open, displayName, bio, socials, links]);

  const setRow = (i: number, patch: Partial<ProfileLink>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit profile">
      <div className="space-y-3 overflow-y-auto p-4 pt-1">
        <label className="block">
          <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-ink/45">Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Display name" style={{ fontSize: 16 }}
            className="min-h-[44px] w-full rounded-xl border border-timber/20 bg-white px-3 outline-none focus:border-terracotta/50" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-ink/45">Bio</span>
          <textarea value={b} onChange={(e) => setB(e.target.value)} rows={3} aria-label="Bio" placeholder="A short line about your Nest…" style={{ fontSize: 16 }}
            className="w-full rounded-xl border border-timber/20 bg-white p-3 outline-none focus:border-terracotta/50" />
        </label>

        {/* Unlimited links — no platform is hard-coded. Label is optional; we derive one. */}
        <div>
          <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-ink/45">Links</span>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input value={row.label ?? ""} onChange={(e) => setRow(i, { label: e.target.value })}
                    placeholder="Label (optional)" aria-label={`Link ${i + 1} label`} style={{ fontSize: 16 }}
                    className="min-h-[40px] w-full rounded-xl border border-timber/20 bg-white px-3 text-sm outline-none focus:border-terracotta/50" />
                  <input value={row.url} onChange={(e) => setRow(i, { url: e.target.value })}
                    placeholder="https://…" aria-label={`Link ${i + 1} URL`} inputMode="url" style={{ fontSize: 16 }}
                    className="min-h-[40px] w-full rounded-xl border border-timber/20 bg-white px-3 text-sm outline-none focus:border-terracotta/50" />
                </div>
                <button onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                  aria-label={`Remove link ${i + 1}`}
                  className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl text-ink/40 hover:bg-white hover:text-rose-600">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setRows((r) => [...r, { label: "", url: "" }])}
            className="mt-2 inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-dashed border-timber/30 px-3 text-xs font-bold text-ink/60 active:scale-95">
            <Plus className="size-4" /> Add link
          </button>
        </div>

        <button
          onClick={() => onSave({
            displayName: name.trim() || undefined,
            bio: b.trim() || undefined,
            links: rows.map((r) => ({ label: r.label?.trim() || undefined, url: r.url.trim() })).filter((r) => r.url),
          })}
          className="min-h-[48px] w-full rounded-xl bg-ink text-sm font-bold text-parchment active:scale-[0.99]"
        >
          Save
        </button>
      </div>
    </BottomSheet>
  );
}

// Day 3.4 — a focused, centred profile-photo modal (was a bottom sheet with a single
// action). Shows the current avatar (or the placeholder), one primary action into the
// EXISTING Avatar Generator at /profile/avatar, and Remove only when there's one to remove.
function AvatarModal({ open, onClose, username, avatarUrl }: { open: boolean; onClose: () => void; username?: string; avatarUrl?: string }) {
  const router = useRouter();
  const [active, setActive] = useState<UserAvatar | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) void getActiveAvatar().then(setActive); }, [open]);

  const remove = async () => {
    if (!active) return;
    setBusy(true); setError(null);
    const res = await deleteAvatar(active.id);
    setBusy(false);
    if (!res.ok) { setError(res.error || "Could not remove the avatar."); return; }
    onClose();
    router.refresh(); // the identity box picks up the cleared avatar
  };

  const has = Boolean(active ?? avatarUrl);
  const preview = active?.publicProfileUrl ?? avatarUrl ?? null;

  return (
    <CenteredModal open={open} onClose={onClose} title="Your avatar">
      <div className="flex flex-col items-center gap-4">
        <div className="grid size-28 place-items-center overflow-hidden rounded-3xl border border-timber/15 bg-parchment">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your avatar" className="size-full object-cover" />
          ) : (
            <Avatar username={username} size={72} />
          )}
        </div>

        <div className="w-full space-y-2">
          <Link
            href="/profile/avatar"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-terracotta text-sm font-black text-parchment active:scale-[0.99]"
          >
            <Camera className="size-4" /> {has ? "Change avatar" : "Create avatar"}
          </Link>
          {has ? (
            <button onClick={remove} disabled={busy} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white text-sm font-bold text-rose-600 disabled:opacity-50">
              <Trash2 className="size-4" /> {busy ? "Removing…" : "Remove avatar"}
            </button>
          ) : null}
          {error ? <p className="text-center text-[11px] text-rose-700">{error}</p> : null}
        </div>
      </div>
    </CenteredModal>
  );
}
