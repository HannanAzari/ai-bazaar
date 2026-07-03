"use client";

// M19 — the warm storybook sky the village + houses sit against: a soft dawn
// gradient, a low sun, a couple of drifting clouds, and rolling hills. Pure CSS/SVG,
// no art assets. Deliberately cozy (Ghibli town, not metaverse skybox).
export function SceneBackdrop({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden>
      {/* sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#fbe9c4] via-[#f7ddb4] to-[#eecf9c]" />
      {/* sun glow */}
      <div className="absolute left-1/2 top-[14%] size-56 -translate-x-1/2 rounded-full bg-[#ffd98a] opacity-60 blur-2xl" />
      <div className="absolute left-1/2 top-[16%] size-24 -translate-x-1/2 rounded-full bg-[#fff2d0] opacity-80 blur-md" />
      {/* clouds */}
      <div className="nest-drift absolute left-[8%] top-[18%] h-8 w-24 rounded-full bg-white/70 blur-md" />
      <div className="nest-drift absolute right-[10%] top-[28%] h-6 w-16 rounded-full bg-white/60 blur-md" style={{ animationDelay: "-6s" }} />
      {/* rolling hills */}
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-2/3 w-full">
        <path d="M0 130 Q100 96 200 124 T400 118 V200 H0 Z" fill="#a9c882" opacity="0.9" />
        <path d="M0 156 Q120 124 240 152 T400 150 V200 H0 Z" fill="#93ac5f" />
        <path d="M0 182 Q140 164 280 180 T400 178 V200 H0 Z" fill="#6e8a47" />
      </svg>
    </div>
  );
}
