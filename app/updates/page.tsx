import { Bell } from "lucide-react";
import { NestAppChrome } from "@/components/nest/app-shell/nest-app-chrome";

export const metadata = {
  title: "Updates",
  robots: { index: false, follow: false },
};

// Phase 7 — a complete-feeling shell without a backend. No notifications system yet;
// this is intentionally a friendly empty state.
export default function UpdatesPage() {
  return (
    <NestAppChrome>
      <div className="pt-1">
        <h1 className="display text-3xl">Updates</h1>
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-timber/25 bg-white/60 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-[#efe7cf] text-terracotta">
            <Bell className="size-7" />
          </span>
          <p className="display text-2xl">No updates yet</p>
          <p className="max-w-xs text-sm text-ink/50">When people interact with your Nest, you&rsquo;ll see it here.</p>
        </div>
      </div>
    </NestAppChrome>
  );
}
