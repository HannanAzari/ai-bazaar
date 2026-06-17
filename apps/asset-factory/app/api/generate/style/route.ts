import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { getGenerationConfig, checkGenerationAllowed, clampBatch, estimateCost } from "@/lib/generation-config";
import { generatedToday as countGeneratedToday, createGenerationJob } from "@/lib/generation-job";
import { runReplicate } from "@/lib/replicate-server";
import { buildStyledPrompt, DEFAULT_STYLE_FAMILY } from "@/lib/styles";
import { isServerSupabaseReady } from "@/lib/supabase-server";
import { uploadImageFromUrl } from "@/lib/server-storage";
import { listJobs, saveJob } from "@/lib/server-candidates";
import { type FactoryCategory, type GenerationJob } from "@/lib/types";

export const dynamic = "force-dynamic";

// Style Lab generation (V3.1). Produces N variation images for a single golden
// item — for visual calibration only. It does NOT create catalog candidates. Same
// safety gate as /api/generate (enabled + token + batch + daily). A job record is
// kept purely for cost tracking.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = (await req.json()) as {
      category?: FactoryCategory;
      subject?: string;
      count?: number;
      generatedToday?: number;
      styleId?: string;
    };
    if (!body.category) return NextResponse.json({ error: "Category is required." }, { status: 400 });
    const styleId = body.styleId ?? DEFAULT_STYLE_FAMILY;

    const config = getGenerationConfig();
    const shared = isServerSupabaseReady();
    const count = clampBatch(Number(body.count ?? 5), config);
    const generatedToday = shared
      ? countGeneratedToday(await listJobs())
      : Math.max(0, Math.floor(Number(body.generatedToday ?? 0)));

    const guard = checkGenerationAllowed(config, count, generatedToday);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    let job = createGenerationJob({
      category: body.category, pack: "style-lab", count, subject: body.subject ?? "",
      requestedBy: "style-lab", dryRun: false, config, styleId,
    });
    job = { ...job, status: "running", startedAt: new Date().toISOString() };

    let imageUrls: string[] = [];
    try {
      const result = await runReplicate(
        { prompt: buildStyledPrompt(body.category, styleId, { subject: body.subject }), negativePrompt: job.negativePrompt, count, model: job.modelName },
        { dryRun: false, config },
      );
      imageUrls = result.imageUrls;
      if (shared) {
        imageUrls = (
          await Promise.all(
            result.imageUrls.map(async (u, i) => {
              try {
                return await uploadImageFromUrl(u, `style-${body.category}-${i + 1}`);
              } catch {
                return null;
              }
            }),
          )
        ).filter((u): u is string => !!u);
      }
      job = {
        ...job,
        status: imageUrls.length > 0 ? "completed" : "failed",
        actualCost: estimateCost(imageUrls.length, config),
        completedAt: new Date().toISOString(),
        error: imageUrls.length === 0 ? "No images returned." : undefined,
      };
    } catch (err) {
      job = { ...job, status: "failed", error: err instanceof Error ? err.message : "Generation failed.", completedAt: new Date().toISOString() };
    }

    if (shared) await saveJob(job);

    return NextResponse.json({ imageUrls, job: job as GenerationJob, persisted: shared });
  } catch (err) {
    return serverError(err);
  }
}
