import { NestAppChrome } from "@/components/nest/app-shell/nest-app-chrome";
import { ProfileClient } from "./profile-client";

// Public creator profile. Reached as /@<handle> (rewritten to /profile/<handle>).
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).replace(/^@/, "");
  return (
    <NestAppChrome>
      <ProfileClient handle={clean} />
    </NestAppChrome>
  );
}
