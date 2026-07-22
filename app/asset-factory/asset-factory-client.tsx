"use client";

import { GenerationStudio } from "@/components/generation/generation-studio";
import { assetModule } from "@/lib/generation-platform/modules/asset-module";

// Asset Factory is now a thin module on the shared Generation Platform. All shell logic
// (gate, stages, review/approve/publish orchestration, sticky bar) lives in
// GenerationStudio; the object engine + screens live in assetModule. Behaviour unchanged.
export function AssetFactoryClient() {
  return <GenerationStudio module={assetModule} />;
}
