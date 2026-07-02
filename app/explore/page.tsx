import { NestAppChrome } from "@/components/nest/app-shell/nest-app-chrome";
import { ExploreClient } from "./explore-client";

export const metadata = {
  title: "Explore",
  robots: { index: false, follow: false },
};

export default function ExplorePage() {
  return (
    <NestAppChrome>
      <ExploreClient />
    </NestAppChrome>
  );
}
