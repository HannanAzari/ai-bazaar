import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { getGenerationConfig, checkProviderAllowed } from "@/lib/generation-config";
import { runOpenAi, friendlyOpenAiError } from "@/lib/openai-server";
import {
  GOLDEN_ROOM_PROMPT,
  GOLDEN_ROOM_NEGATIVE,
  clampCount,
  nextRound,
  normalizeScore,
  isGoldenRoomStatus,
  type GoldenRoomCandidate,
} from "@/lib/golden-room";
import { readCandidates, appendCandidates, updateCandidate, saveImagePng } from "@/lib/golden-room-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Golden Room art-direction API. GET lists candidates + config status; POST generates
// a round (max 5) via OpenAI (or a dry run that exercises the workflow without a key);
// PATCH saves a candidate's score/critique/status. Local filesystem persistence.

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const config = getGenerationConfig();
    const candidates = await readCandidates();
    return NextResponse.json({
      candidates,
      status: {
        openaiConfigured: config.openaiTokenConfigured,
        openaiEnabled: config.openaiEnabled,
        provider: config.provider,
        model: config.openaiModel,
        ready: config.openaiTokenConfigured && config.openaiEnabled,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = (await req.json()) as {
      round?: number;
      prompt?: string;
      negativePrompt?: string;
      count?: number;
      dryRun?: boolean;
    };

    const existing = await readCandidates();
    const round = Number.isFinite(body.round) ? Number(body.round) : nextRound(existing);
    const prompt = (body.prompt ?? GOLDEN_ROOM_PROMPT).trim() || GOLDEN_ROOM_PROMPT;
    const negativePrompt = (body.negativePrompt ?? GOLDEN_ROOM_NEGATIVE).trim();
    const count = clampCount(Number(body.count ?? 3));
    const dryRun = Boolean(body.dryRun);

    const config = getGenerationConfig();
    const now = new Date().toISOString();

    // Dry run: build placeholder candidates so the workflow + persistence are testable
    // without an OpenAI key (or to avoid burning credits while wiring up).
    if (dryRun) {
      const made: GoldenRoomCandidate[] = Array.from({ length: count }, (_, i) =>
        baseCandidate(round, prompt, negativePrompt, now, true, placeholderImage(round, i + 1)),
      );
      await appendCandidates(made);
      return NextResponse.json({ candidates: made, dryRun: true });
    }

    // Real generation — gate on OpenAI being configured + enabled.
    const guard = checkProviderAllowed(config, "openai", count, 0);
    if (!guard.ok) {
      return NextResponse.json(
        {
          error: `${guard.error} To enable: set OPENAI_API_KEY and OPENAI_GENERATION_ENABLED=true (server-only) in apps/asset-factory/.env.local. Or use Dry run to test the workflow.`,
        },
        { status: guard.status },
      );
    }

    let result;
    try {
      result = await runOpenAi(
        { prompt, negativePrompt, count, model: config.openaiModel, size: "1024x1536" },
        { config },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenAI generation failed.";
      return NextResponse.json({ error: friendlyOpenAiError(message) }, { status: 502 });
    }

    if (result.images.length === 0) {
      return NextResponse.json({ error: "OpenAI returned no images." }, { status: 502 });
    }

    const made: GoldenRoomCandidate[] = [];
    for (const img of result.images) {
      const c = baseCandidate(round, prompt, negativePrompt, now, false, "");
      if (img.b64) {
        await saveImagePng(c.id, new Uint8Array(Buffer.from(img.b64, "base64")));
        c.imageUrl = `/api/golden-room/image/${c.id}`;
      } else if (img.url) {
        c.imageUrl = img.url;
      } else {
        continue;
      }
      made.push(c);
    }

    if (made.length === 0) {
      return NextResponse.json({ error: "Generated images could not be stored." }, { status: 502 });
    }

    await appendCandidates(made);
    return NextResponse.json({ candidates: made });
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = (await req.json()) as { id?: string; score?: unknown; critique?: unknown; status?: unknown };
    if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const patch: Partial<Pick<GoldenRoomCandidate, "score" | "critique" | "status">> = {};
    if ("score" in body) patch.score = normalizeScore(body.score);
    if ("critique" in body) patch.critique = String(body.critique ?? "");
    if ("status" in body) {
      if (!isGoldenRoomStatus(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      patch.status = body.status;
    }

    const updated = await updateCandidate(body.id, patch);
    if (!updated) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    return NextResponse.json({ candidate: updated });
  } catch (err) {
    return serverError(err);
  }
}

function baseCandidate(
  round: number,
  prompt: string,
  negativePrompt: string,
  createdAt: string,
  dryRun: boolean,
  imageUrl: string,
): GoldenRoomCandidate {
  return {
    id: `gr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    round,
    imageUrl,
    prompt,
    negativePrompt,
    score: null,
    critique: "",
    status: "pending",
    dryRun,
    createdAt,
  };
}

/** A warm inline-SVG placeholder (data URL) for dry-run candidates. */
function placeholderImage(round: number, n: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536">
<rect width="1024" height="1536" fill="#e7d2a4"/>
<rect x="120" y="160" width="784" height="760" fill="#ecd9b6"/>
<polygon points="120,920 904,920 1024,1536 0,1536" fill="#bd8a50"/>
<rect x="360" y="980" width="304" height="120" rx="40" fill="#3d7068"/>
<ellipse cx="512" cy="1180" rx="260" ry="70" fill="#ecd9c8"/>
<text x="512" y="500" font-family="sans-serif" font-size="46" fill="#6b5847" text-anchor="middle">DRY RUN</text>
<text x="512" y="560" font-family="sans-serif" font-size="34" fill="#8a7560" text-anchor="middle">Round ${round} · candidate ${n}</text>
<text x="512" y="610" font-family="sans-serif" font-size="26" fill="#a08a6f" text-anchor="middle">(no OpenAI image — workflow test)</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
