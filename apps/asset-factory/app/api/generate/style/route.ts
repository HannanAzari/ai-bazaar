import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { getGenerationConfig, checkProviderAllowed, clampBatchForProvider } from "@/lib/generation-config";
import { generatedToday as countGeneratedToday } from "@/lib/generation-job";
import { executeStyleGeneration } from "@/lib/server-generate";
import { DEFAULT_STYLE_FAMILY } from "@/lib/styles";
import { isProvider, type ProviderId } from "@/lib/providers";
import { isServerSupabaseReady } from "@/lib/supabase-server";
import { bucketImageStore } from "@/lib/server-storage";
import { listJobs, saveJob } from "@/lib/server-candidates";
import { type FactoryCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

// Style Lab generation (V3.1 → V3.2). Produces N variation images for one golden
// item + style — calibration only, never catalog candidates. Same safety gate as
// /api/generate (enabled + token + batch + daily). On success returns 200 with real
// image URLs; on failure/empty returns a non-2xx with a visible error (so the client
// never silently shows placeholders).
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = (await req.json()) as {
      category?: FactoryCategory;
      subject?: string;
      count?: number;
      generatedToday?: number;
      styleId?: string;
      provider?: string;
    };
    if (!body.category) return NextResponse.json({ error: "Category is required." }, { status: 400 });
    const styleId = body.styleId ?? DEFAULT_STYLE_FAMILY;

    const config = getGenerationConfig();
    const provider: ProviderId = isProvider(body.provider ?? "") ? (body.provider as ProviderId) : config.provider;
    const shared = isServerSupabaseReady();
    const count = clampBatchForProvider(Number(body.count ?? 1), config, provider);
    const generatedToday = shared
      ? countGeneratedToday(await listJobs())
      : Math.max(0, Math.floor(Number(body.generatedToday ?? 0)));

    const guard = checkProviderAllowed(config, provider, count, generatedToday);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const result = await executeStyleGeneration({
      category: body.category,
      subject: body.subject ?? "",
      styleId,
      count,
      config,
      provider,
      storeImage: shared ? bucketImageStore : undefined,
    });

    if (shared) await saveJob(result.job);

    // Failure / no images → surface a visible error, NOT a 200 with empty urls.
    if (!result.ok) {
      const error = result.job.error ?? "The provider returned no images.";
      console.error("[asset-factory] style generation failed:", { provider, styleId, category: body.category, error });
      return NextResponse.json(
        { error, imageUrls: [], job: result.job, status: result.job.status },
        { status: 502 },
      );
    }

    return NextResponse.json({ imageUrls: result.imageUrls, job: result.job, persisted: shared });
  } catch (err) {
    return serverError(err);
  }
}
