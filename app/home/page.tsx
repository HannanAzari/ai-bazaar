import { NestAppChrome } from "@/components/nest/app-shell/nest-app-chrome";
import { HomeClient } from "./home-client";

export const metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return (
    <NestAppChrome>
      <HomeClient />
    </NestAppChrome>
  );
}
