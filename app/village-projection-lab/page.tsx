import type { Metadata } from "next";
import { VillageProjectionLabClient } from "./lab-client";

export const metadata: Metadata = {
  title: "Village Projection Lab",
  robots: { index: false, follow: false },
};

// Isolated prototype for the pseudo-3D curved-world village projection. Not part
// of the shipped app surface — a tuning bench to dial in the feel before the real
// Village adopts lib/village-projection. Safe to delete once integrated.
export default function VillageProjectionLabPage() {
  return <VillageProjectionLabClient />;
}
