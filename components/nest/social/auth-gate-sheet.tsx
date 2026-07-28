"use client";

import { Bookmark, Heart, MessageCircle, UserPlus } from "lucide-react";
import { CenteredModal } from "@/components/nest/profile/modal";
import { AuthPanel } from "@/components/nest/app-shell/auth-panel";

// M20 — THE reusable authentication prompt. When a guest taps like / follow / comment we ask
// them to join in place (never navigate away). It used to be a bottom sheet that read as
// pinned to the top of the screen; it is now a centred premium modal on a blurred backdrop,
// styled consistently with the avatar modal.
//
// The export name is unchanged so every existing call site (like / follow / comment) is
// upgraded without touching them.

const PERKS = [
  { icon: UserPlus, label: "Follow creators" },
  { icon: Heart, label: "Like Nests" },
  { icon: MessageCircle, label: "Comment" },
  { icon: Bookmark, label: "Save favourites" },
];

export function AuthGateSheet({ open, onClose, action = "join in" }: { open: boolean; onClose: () => void; action?: string }) {
  return (
    <CenteredModal open={open} onClose={onClose} title="Join Nestudio">
      <div className="space-y-4">
        {/* M22 — the reason you're here leads; the perks support it. It used to sit under
            the perk grid, so the pitch arrived before the context. */}
        <p className="-mt-1 text-[13px] leading-snug text-ink/60">Sign in to {action} — it only takes a moment.</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
          {PERKS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-1.5 text-[12px] font-semibold text-ink/60">
              <Icon className="size-3.5 shrink-0 text-terracotta" /> {label}
            </li>
          ))}
        </ul>
        <AuthPanel onAuthed={onClose} />
      </div>
    </CenteredModal>
  );
}
