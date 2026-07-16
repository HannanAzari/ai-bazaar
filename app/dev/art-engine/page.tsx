import type { Metadata } from "next";
import { ArtEngineClient } from "./art-engine-client";

export const metadata: Metadata = {
  title: "Art Engine — Nestudio (internal)",
  robots: { index: false, follow: false },
};

// Internal developer tool (M33 Art Engine). Measures the official style, shows the
// Style Validator gate, and runs the family test + benchmark objects. NOT a user surface.
export default function ArtEnginePage() {
  return <ArtEngineClient />;
}
