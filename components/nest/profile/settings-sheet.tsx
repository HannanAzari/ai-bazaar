"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, LogOut, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/nest/social/bottom-sheet";
import { CenteredModal } from "@/components/nest/profile/modal";
import { useNestIdentity } from "@/components/nest/app-shell/use-nest-identity";

// ── M23B §2 — creator Settings ───────────────────────────────────────────────
//
// Reached from the gear in the creator's OWN Profile header. It is never rendered on
// another creator's public Profile — the gear is not hidden with CSS, the owner check
// decides whether it exists at all.
//
// Two entries, per the sprint: Sign out (works now) and Delete account.

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { signOut } = useNestIdentity();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const doSignOut = async () => {
    setBusy(true);
    await signOut();
    onClose();
    // Replace, not push: Back must not walk into a signed-in screen whose owner controls
    // would render against a session that no longer exists.
    router.replace("/home");
    router.refresh();
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Settings">
        <div className="space-y-2 p-4 pt-1">
          <button
            onClick={doSignOut}
            disabled={busy}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-timber/15 bg-white px-4 text-left text-[15px] font-black text-ink disabled:opacity-50 active:scale-[0.99]"
          >
            {busy ? <Loader2 className="size-4 animate-spin text-ink/40" /> : <LogOut className="size-4 text-ink/45" />}
            {busy ? "Signing out…" : "Sign out"}
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 text-left text-[15px] font-black text-rose-600 active:scale-[0.99]"
          >
            <Trash2 className="size-4" />
            Delete account
          </button>

          <p className="px-1 pt-1 text-[11px] leading-snug text-ink/40">
            Signing out leaves your published Nests exactly where they are — they belong to your
            account, not to this device.
          </p>
        </div>
      </BottomSheet>

      <DeleteAccountModal open={confirmDelete} onClose={() => setConfirmDelete(false)} onDeleted={() => {
        setConfirmDelete(false);
        onClose();
        router.replace("/home");
        router.refresh();
      }} />
    </>
  );
}

// ── Delete account ───────────────────────────────────────────────────────────
//
// D-09: no fake deletion. The destructive confirmation is real, and it calls a real
// server route that performs the real cascade with the service-role key. If that route
// reports the deletion is not available (env missing, or a step it cannot complete
// safely), the UI says so plainly instead of showing a success screen — the one outcome
// that would be worse than not offering the button at all.

function DeleteAccountModal({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { signOut } = useNestIdentity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const armed = confirmText.trim().toLowerCase() === "delete";

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setBusy(false);
        setError(body.error || "Your account could not be deleted. Nothing was changed.");
        return;
      }
      // The server has removed the account; clear the dead session from this browser.
      await signOut();
      setBusy(false);
      onDeleted();
    } catch {
      setBusy(false);
      setError("Could not reach the server. Nothing was changed.");
    }
  };

  return (
    <CenteredModal open={open} onClose={busy ? () => {} : onClose} title="Delete your account?">
      <div className="space-y-4">
        <div className="flex gap-3 rounded-2xl bg-rose-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <p className="text-[13px] leading-snug text-rose-900">
            This removes your profile, house, Nests and related account data.
            <br />
            <strong className="font-black">This cannot be undone.</strong>
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-ink/45">
            Type DELETE to confirm
          </span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label="Type DELETE to confirm"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{ fontSize: 16 }}
            className="min-h-[48px] w-full rounded-xl border border-timber/20 bg-white px-3 outline-none focus:border-rose-400"
          />
        </label>

        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-bold text-rose-700">{error}</p>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="min-h-[48px] flex-1 rounded-xl border border-timber/20 bg-white text-sm font-black text-ink/70 disabled:opacity-50"
          >
            Keep my account
          </button>
          <button
            onClick={submit}
            disabled={!armed || busy}
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
