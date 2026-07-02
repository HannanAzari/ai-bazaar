import { NestAppChrome } from "@/components/nest/app-shell/nest-app-chrome";
import { ProfileDashboardClient } from "./profile-dashboard-client";

export const metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

// M15.1: /profile is the creator's private dashboard (public profile is /@handle,
// served from /profile/[handle]).
export default function ProfilePage() {
  return (
    <NestAppChrome>
      <ProfileDashboardClient />
    </NestAppChrome>
  );
}
