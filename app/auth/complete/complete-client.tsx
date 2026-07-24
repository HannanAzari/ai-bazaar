"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/auth/callback-redirect";

// The neutral bounce. Cookies are already set (the callback wrote them onto its redirect),
// so a fresh navigation to the destination is made WITH the session present.
export function CompleteClient({ next }: { next: string | null }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(safeNext(next) ?? "/profile");
  }, [next, router]);

  return (
    <section className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-ink/15 border-t-terracotta" aria-hidden />
        <p className="text-sm font-semibold text-ink/70">Signing you in…</p>
      </div>
    </section>
  );
}
