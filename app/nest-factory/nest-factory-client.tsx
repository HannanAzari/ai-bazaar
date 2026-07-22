"use client";

import { GenerationStudio } from "@/components/generation/generation-studio";
import { nestModule } from "@/lib/generation-platform/modules/nest-module";

// Nest Factory is now a thin module on the shared Generation Platform. All shell logic
// (gate, stages, review/approve/publish orchestration, sticky bar) lives in
// GenerationStudio; the empty-room engine + screens live in nestModule. Behaviour unchanged.
export function NestFactoryClient() {
  return <GenerationStudio module={nestModule} />;
}
