import { HomeClient } from "./home-client";

export const metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

// HomeClient owns a full-height feed layout (incl. its own BottomNav), so it isn't
// wrapped in the padded NestAppChrome.
export default function HomePage() {
  return <HomeClient />;
}
