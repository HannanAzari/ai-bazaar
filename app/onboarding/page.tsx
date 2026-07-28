import { redirect } from "next/navigation";

// M21 — /onboarding used to run the pre-pivot shop/house funnel and finished on
// `/shop/<address>`, a route that now redirects to /home. A brand-new user therefore
// completed onboarding and landed on the feed with nothing to show for it (the single
// worst friction point in the app — see docs/BETA_NAVIGATION_AUDIT.md, N-01).
//
// The canonical first run is Create → editor → publish, so this route now forwards there.
// The legacy implementation is preserved next to this file (…legacy-shop-onboarding.tsx.bak)
// rather than deleted, so nothing is lost if the flow is ever revisited.
export default function OnboardingPage() {
  redirect("/create");
}
