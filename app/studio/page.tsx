import { redirect } from "next/navigation";

// Phase 5 (M15): the V1 studio was a dead-end for signed-out creators (a login wall
// hit right after publishing a Nest). The single Nestudio app now lives behind the
// Home tab, so /studio redirects there — no more confusing wall post-publish.
export default function StudioPage() {
  redirect("/home");
}
