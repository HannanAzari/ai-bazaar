"use client";

import { GenerationStudio } from "@/components/generation/generation-studio";
import { avatarModule } from "@/lib/generation-platform/modules/avatar-module";

// Avatar Factory = the avatar module on the shared Generation Platform. No shell code —
// the entire create → review → approve → publish flow is the shared engine; only the
// avatar engine, screens, consent, and user-auth mode differ.
export function AvatarStudioClient() {
  return <GenerationStudio module={avatarModule} />;
}
