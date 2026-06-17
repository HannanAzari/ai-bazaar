import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { getGenerationConfig, checkProviderAllowed } from "@/lib/generation-config";
import { generatedToday as countGeneratedToday } from "@/lib/generation-job";
import { executeGeneration } from "@/lib/server-generate";
import { isServerSupabaseReady } from "@/lib/supabase-server";
import { bucketImageStore } from "@/lib/server-storage";
import { isProvider, type ProviderId } from "@/lib/providers";
import {
  listCandidates,
  listPacks,
  listJobs,
  addCandidates,
  saveJob,
} from "@/lib/server-candidates";
import { type FactoryCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

// REAL generation (V3, Task 6). Password-gated, flag-checked, batch + daily limits
// enforced. Dry-run is handled entirely client-side (zero cost) — this route only
// runs when the operator asks for a real, billable generation.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  try {
    const body = (await req.json()) as {
      category?: FactoryCategory;
      pack?: string;
      count?: number;
      subject?: string;
      requestedBy?: string;
      generatedToday?: number;
      styleId?: string;
      provider?: string;
    };
    const config = getGenerationConfig();
    const count = Number(body.count ?? 1);
    const provider: ProviderId = isProvider(body.provider ?? "") ? (body.provider as ProviderId) : config.provider;
    const shared = isServerSupabaseReady();

    if (!body.category) {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }

    // Daily usage: authoritative from the DB in shared mode; client-reported
    // (clamped) in local mode where the server has no job store.
    const generatedToday = shared
      ? countGeneratedToday(await listJobs())
      : Math.max(0, Math.floor(Number(body.generatedToday ?? 0)));

    const guard = checkProviderAllowed(config, provider, count, generatedToday);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const existing = shared ? await listCandidates() : [];
    const pack = shared && body.pack ? (await listPacks()).find((p) => p.id === body.pack || p.slug === body.pack) : undefined;

    const result = await executeGeneration({
      input: {
        category: body.category,
        pack: body.pack ?? "generated",
        count,
        subject: body.subject ?? "",
        requestedBy: body.requestedBy ?? "anonymous",
        dryRun: false,
        config,
        styleId: body.styleId,
        provider,
      },
      existing,
      pack,
      storeImage: shared ? bucketImageStore : undefined,
    });

    // Persist server-side in shared mode; otherwise the client persists locally.
    if (shared) {
      if (result.candidates.length > 0) await addCandidates(result.candidates);
      await saveJob(result.job);
    }

    return NextResponse.json({
      job: result.job,
      candidates: result.candidates,
      validations: result.validations,
      summary: result.summary,
      persisted: shared,
    });
  } catch (err) {
    return serverError(err);
  }
}
