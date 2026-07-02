import { redirect } from "next/navigation";

// M15: Nestudio opens into the real app shell (the Home tab), not the V1 village
// landing. Villages are out of scope this sprint; the VillageWorld component is
// preserved (components/village-world.tsx) for when they return as a real tab.
export default function RootPage() {
  redirect("/home");
}
