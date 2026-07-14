import type { Metadata } from "next";
import { VillageLabClient } from "./village-lab-client";

export const metadata: Metadata = {
  title: "Rolling Village Lab",
  robots: { index: false, follow: false },
};

// Nestudio Village V2 prototype — an endless, cozy rolling-hills neighbourhood.
// A tuning bench to validate the *experience* before the real Village adopts it.
// Not part of the shipped surface; safe to delete once integrated.
export default function VillageLabPage() {
  return <VillageLabClient />;
}
