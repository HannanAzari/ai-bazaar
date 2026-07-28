import { Suspense } from "react";
import { CompleteClient } from "./complete-client";

// Neutral landing after the PKCE exchange. Reached ONLY via server redirect from
// /auth/callback (never via <Link>), so it is inherently non-prefetched — the session
// cookie is already set by the time this renders, then we forward to the real destination.
export const dynamic = "force-dynamic";
export const metadata = { title: "Signing you in…", robots: { index: false, follow: false } };

export default async function AuthCompletePage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  return (
    <Suspense>
      <CompleteClient next={next} />
    </Suspense>
  );
}
