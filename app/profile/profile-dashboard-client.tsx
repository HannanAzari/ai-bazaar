"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Pencil, Plus, Settings, Trash2, TriangleAlert } from "lucide-react";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";
import { shouldRedirectToOnboarding } from "@/lib/auth/post-sign-in-route";
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
import { onSocialChanged, viewsForOwner } from "@/lib/nest-social";
import { useCreatorSocial } from "@/components/nest/social/use-creator-social";
import { viewCountForSlugs } from "@/lib/nest/supabase-views-repo";
import { nestBackend as backendForViews } from "@/lib/nest-repo";
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
  const { ownerId, signedIn, loading, profile, profileError, bootstrap, retryBootstrap, updateProfile } = useNestIdentity();
  const { drafts, published, loading: nestsLoading, error: nestsError, remove } = useCreatorNests(ownerId, { includeDrafts: true });
  const [views, setViews] = useState(0);
  const [editing, setEditing] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // M23B §1 — a signed-in creator who has not finished onboarding is sent to finish it.
  //
  // HOTFIX (M23B.1): this used to fire while the profile was still null-because-loading,
  // and /onboarding bounced straight back once the profile FAILED to load — an infinite
  // redirect loop that re-queried the profile dozens of times and kept the auth lock
  // saturated. `shouldRedirectToOnboarding` only answers true on a SETTLED, genuinely
  // incomplete profile; loading and error both mean "stay put".
  useEffect(() => {
    if (signedIn && shouldRedirectToOnboarding(bootstrap)) router.replace("/onboarding");
  }, [signedIn, bootstrap, router]);

  // M24 §8 — one shared source for the follower count (see use-creator-social).
  const { followerCount: followers } = useCreatorSocial(ownerId);

  // M24B §3 — Views = the SUM over this creator's published Nests (rooms.xyz model).
  useEffect(() => {
    if (!ownerId) return;
    if (backendForViews() !== "supabase") {
      const refresh = () => setViews(viewsForOwner(ownerId));
      refresh();
      return onSocialChanged(refresh);
    }
    let alive = true;
    const slugs = published.map((n) => n.slug).filter((s): s is string => !!s);
    void viewCountForSlugs(slugs).then((n) => { if (alive) setViews(n); });
    return () => { alive = false; };
  }, [ownerId, published]);

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
          <button onClick={() => void retryBootstrap()} className="mt-3 min-h-[44px] rounded-xl bg-terracotta px-5 text-sm font-bold text-parchment">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Still resolving, or the redirect above is in flight — render nothing rather than a
  // half-built Profile that would flash and then navigate away.
  if (bootstrap.status === "loading" || !profile?.username) return null;

  return (
    <div className="flex min-h-full flex-col gap-2.5 pb-2">
      {/* M24 §11 — no Back button. Profile is a bottom-nav TAB, not a nested modal page:
          `history.back()` from here lands wherever the user happened to come from, which
          is why it "navigates incorrectly". The nav is the way out. */}
      <TopControls
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
      <NestList drafts={drafts} published={published} loading={nestsLoading} error={nestsError} onDelete={remove} />

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
  onDelete,
}: {
  drafts: CreatorNest[];
  published: CreatorNest[];
  loading: boolean;
  error: string | null;
  onDelete: (nestId: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<CreatorNest | null>(null);
  const items = [...drafts, ...published];

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
      {items.map((n) => (
        <div key={n.key} className="flex items-center gap-3 rounded-2xl border border-timber/15 bg-white/90 p-2 shadow-soft">
          {/* M24B §5 — the whole row IS the edit control. There is no separate "Edit"
              button that does nothing: one target, one behaviour. */}
          <Link href={n.editHref} className="flex min-w-0 flex-1 items-center gap-3">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-timber/10">
              <NestPreview doc={n.doc} className="h-full w-full" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-ink">{n.doc.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${n.isDraft ? "bg-ink/8 text-ink/60" : "bg-[#4d7358] text-white"}`}>
                  {n.isDraft ? "Draft" : VISIBILITY_LABEL[n.visibility] ?? n.visibility}
                </span>
                {/* §4 — live, but with unpublished edits waiting. */}
                {n.hasPendingDraft ? (
                  <span className="inline-block rounded-full bg-[#d9913c]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#8a5c1b]">
                    Draft changes
                  </span>
                ) : null}
              </span>
            </span>
          </Link>

          <span className="flex shrink-0 items-center gap-1 pr-0.5">
            <Link
              href={n.editHref}
              aria-label={`Edit ${n.doc.title}`}
              className="grid size-9 place-items-center rounded-full text-ink/50 hover:bg-parchment hover:text-ink"
            >
              <Pencil className="size-4" />
            </Link>
            <button
              onClick={() => setConfirming(n)}
              aria-label={`Delete ${n.doc.title}`}
              className="grid size-9 place-items-center rounded-full text-ink/40 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="size-4" />
            </button>
          </span>
        </div>
      ))}

      <DeleteNestModal
        nest={confirming}
        onClose={() => setConfirming(null)}
        onConfirm={async () => {
          if (!confirming) return;
          await onDelete(confirming.doc.id);
          setConfirming(null);
        }}
      />
    </section>
  );
}

// ── M24B §6 — deleting a Nest ────────────────────────────────────────────────
//
// Deleting the `nests` row cascades `nest_objects`, and likes/comments/views are keyed by
// slug so they simply stop being reachable. The Nest leaves the feed, Explore, the
// Profile, the House and search at once — there is no second index to keep in step.
function DeleteNestModal({
  nest,
  onClose,
  onConfirm,
}: {
  nest: CreatorNest | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <CenteredModal open={!!nest} onClose={busy ? () => {} : onClose} title="Delete Nest?">
      <div className="space-y-4">
        <p className="text-[13px] leading-snug text-ink/70">
          <strong className="font-black text-ink">{nest?.doc.title}</strong> will be removed from
          your Profile, your House, Home, Explore and search.
          <br />
          <strong className="font-black">This cannot be undone.</strong>
        </p>
        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-bold text-rose-700">{error}</p>
        ) : null}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="min-h-[48px] flex-1 rounded-xl border border-timber/20 bg-white text-sm font-black text-ink/70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              setError(null);
              try { await onConfirm(); } catch (e) {
                setError(e instanceof Error ? e.message : "That Nest could not be deleted.");
              } finally { setBusy(false); }
            }}
            disabled={busy}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-black text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </CenteredModal>
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
