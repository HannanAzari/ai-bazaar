import Link from "next/link";
import { flags } from "@/lib/flags";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink/10 py-10">
      <div className="shell flex flex-col gap-4 text-sm text-ink/55 sm:flex-row sm:items-center sm:justify-between">
        <p>AI Bazaar. Little houses, personal worlds.</p>
        <div className="flex flex-wrap gap-5">
          <Link href="/discover">Explore</Link>
          <Link href="/tags">Tags</Link>
          {flags.collections && <Link href="/collections">Collections</Link>}
          {flags.activityFeed && <Link href="/activity">Activity</Link>}
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/safety">Safety</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
