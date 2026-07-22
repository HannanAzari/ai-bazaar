import { AvatarStudioClient } from "./avatar-studio-client";

// Profile → Avatar → Create/Replace. The primary Avatar Factory entry point. User-owned,
// private-by-default, real user auth (server-enforced). Not part of the founder global-library
// workflow. Deep profile-header + editor "My Avatar" wiring is gated on provisioning + auth.
export const metadata = { title: "My Avatar · Nestudio", robots: { index: false, follow: false } };

export default function ProfileAvatarPage() {
  return <AvatarStudioClient />;
}
