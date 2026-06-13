import { getRuntimeMode, runtimeModeLabel } from "@/lib/runtime-mode";

// A tiny, dev-only chip showing whether the app is running against the
// localStorage demo or a real Supabase backend. Renders nothing in production
// builds, so it never ships to end users.
export function DevModeBadge() {
  if (process.env.NODE_ENV === "production") return null;

  const mode = getRuntimeMode();
  const live = mode === "production";

  return (
    <div
      aria-hidden="true"
      className={
        "pointer-events-none fixed bottom-2 left-2 z-[100] select-none rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm backdrop-blur " +
        (live
          ? "border-emerald-300 bg-emerald-50/90 text-emerald-700"
          : "border-amber-300 bg-amber-50/90 text-amber-700")
      }
      title={`Backend mode: ${runtimeModeLabel(mode)} (dev-only badge)`}
    >
      {runtimeModeLabel(mode)}
    </div>
  );
}
