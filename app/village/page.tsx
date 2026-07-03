import { VillageClient } from "./village-client";

// M19 — the Village: a cozy hex neighborhood of creator Houses you wander and enter.
// The discovery layer as a *place*, not a feed.
export const metadata = {
  title: "The Village",
};

export default function VillagePage() {
  return <VillageClient />;
}
