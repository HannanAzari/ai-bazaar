import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { listJobs, saveJob } from "@/lib/server-candidates";
import { type GenerationJob } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    return NextResponse.json({ jobs: await listJobs() });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = (await req.json()) as { job?: GenerationJob };
    if (!body.job) return NextResponse.json({ error: "Expected `job`." }, { status: 400 });
    await saveJob(body.job);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
