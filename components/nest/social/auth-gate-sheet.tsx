"use client";

import { BottomSheet } from "@/components/nest/social/bottom-sheet";
import { AuthPanel } from "@/components/nest/app-shell/auth-panel";

// M18 — when a guest taps like / follow / comment, prompt sign-in in place (a sheet),
// without navigating away. On success the sheet closes and the action can proceed.
export function AuthGateSheet({ open, onClose, action = "join in" }: { open: boolean; onClose: () => void; action?: string }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Sign in">
      <div className="px-4 pb-5 pt-1">
        <AuthPanel intro={`Sign in to ${action} — it only takes a moment.`} onAuthed={onClose} />
      </div>
    </BottomSheet>
  );
}
