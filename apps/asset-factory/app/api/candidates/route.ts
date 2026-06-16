import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { listCandidates, saveCandidate, addCandidates } from "@/lib/server-candidates";
import { type AssetCandidate } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    return NextResponse.json({ candidates: await listCandidates() });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = (await req.json()) as {
      candidate?: AssetCandidate;
      candidates?: AssetCandidate[];
    };
    if (Array.isArray(body.candidates)) {
      const candidates = await addCandidates(body.candidates);
      return NextResponse.json({ candidates });
    }
    if (body.candidate) {
      await saveCandidate(body.candidate);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Expected `candidate` or `candidates`." }, { status: 400 });
  } catch (err) {
    return serverError(err);
  }
}
