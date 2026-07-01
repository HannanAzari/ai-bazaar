import { NestEditor } from "@/components/nest/editor/nest-editor";

// Internal, unlinked visual Nest Editor (M7A mobile UX). A full-screen, mobile-first
// editor: hero Nest canvas, compact toolbar, Arrange/Assets/Preview modes, a polished
// transform frame with pinch/rotate gestures, a Telegram-style asset keyboard, and an
// Advanced sheet for internal precision controls. The editor authors structured
// manifests — it never bakes the Nest into an image. Not linked.

export const metadata = {
  title: "Nest Editor — Nestudio internal",
  robots: { index: false, follow: false },
};

export default function NestEditorPage() {
  // NestEditor renders as a fixed full-screen surface; no wrapper padding needed.
  return <NestEditor />;
}
