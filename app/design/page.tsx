import { House } from "@/components/scene/house";
import { bazaars } from "@/lib/data";

export const metadata = { title: "House kit", robots: { index: false } };

/**
 * Internal design showcase for the house kit — not linked from the app.
 * Renders seeds, states, and LODs side by side for visual review.
 */
export default function DesignPage() {
  const accents = bazaars.map((b) => ({ id: b.id, accent: b.accent, name: b.name }));

  return (
    <section className="shell space-y-12 py-10">
      <div>
        <p className="eyebrow text-terracotta">House kit · internal</p>
        <h1 className="display mt-1 text-4xl">Every house unique, every house stable.</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          Seeded from village + slot. Same seed always draws the same house.
        </p>
      </div>

      <div>
        <h2 className="display mb-4 text-2xl">Street LOD — one per village</h2>
        <div className="grid grid-cols-2 gap-4 rounded-4xl bg-[#dcd5b8] p-6 sm:grid-cols-5">
          {accents.map((v, i) => (
            <div key={v.id} className="text-center">
              <House seed={`${v.id}:${i + 3}`} accent={v.accent} state="lived" lod="street" name={v.name} />
              <p className="mt-1 text-xs font-bold text-ink-soft">{v.name}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="display mb-4 text-2xl">States — open, lived-in, yours</h2>
        <div className="grid max-w-2xl grid-cols-3 gap-4 rounded-4xl bg-[#dcd5b8] p-6">
          {(["open", "lived", "owned"] as const).map((state) => (
            <div key={state} className="text-center">
              <House seed="saffron-yard:14" accent="#d9913c" state={state} lod="street" name={state === "open" ? undefined : "The Quiet Kettle"} />
              <p className="mt-1 text-xs font-bold text-ink-soft">{state}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="display mb-4 text-2xl">Variety — twelve neighbours, one street</h2>
        <div className="grid grid-cols-3 gap-3 rounded-4xl bg-[#dcd5b8] p-6 sm:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <House key={i} seed={`cedar-ring:${i + 1}`} accent="#4d7358" state={i % 3 === 0 ? "open" : "lived"} lod="street" />
          ))}
        </div>
      </div>

      <div>
        <h2 className="display mb-4 text-2xl">Card and map LODs</h2>
        <div className="flex flex-wrap items-end gap-6 rounded-4xl bg-[#dcd5b8] p-6">
          <div className="w-40"><House seed="moon-court:15" accent="#315d7a" state="lived" lod="card" /></div>
          <div className="w-40"><House seed="rose-arcade:22" accent="#a94f5c" state="lived" lod="card" /></div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="w-7"><House seed={`velvet-square:${i + 1}`} accent="#74547d" state={i % 2 ? "lived" : "open"} lod="map" /></div>
          ))}
        </div>
      </div>
    </section>
  );
}
