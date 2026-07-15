import type { Metadata } from "next";
import { BenchmarkClient } from "./benchmark-client";

export const metadata: Metadata = {
  title: "Asset Benchmark — Nestudio (internal)",
  robots: { index: false, follow: false },
};

// Internal developer tool (M32). One source image → cutout → generate across every
// provider → side-by-side → score against the Asset DNA. NOT a user surface.
export default function AssetBenchmarkPage() {
  return <BenchmarkClient />;
}
