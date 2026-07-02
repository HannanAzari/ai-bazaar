import { redirect } from "next/navigation";

// M15.1 (was M15): the V1 studio was a dead-end for signed-out creators (a login wall
// hit right after publishing a Nest). The creator's dashboard now lives at /profile, so
// /studio redirects there — no more confusing wall post-publish.
export default function StudioPage() {
  redirect("/profile");
}
