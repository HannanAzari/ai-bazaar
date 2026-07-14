import type { Metadata } from "next";
import { CreatorStudioClient } from "./creator-studio-client";

export const metadata: Metadata = {
  title: "AI Creator Studio · Nestudio",
  robots: { index: false, follow: false },
};

// M20 — the AI Creator Studio. Proves the one reusable AI pipeline end-to-end
// (upload → transform → transparent asset → approve → save → editor). Furniture is
// the single enabled vertical; the engine, pipeline, prompts and inventory are the
// shared foundation for every future studio.
export default function CreatorStudioPage() {
  return <CreatorStudioClient />;
}
