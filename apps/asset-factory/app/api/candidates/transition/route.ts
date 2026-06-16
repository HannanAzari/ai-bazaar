import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { applyAction } from "@/lib/server-candidates";
import { type AssetCandidate, type ReviewAction } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = (await req.json()) as { candidate?: AssetCandidate; action?: ReviewAction };
    if (!body.candidate || !body.action) {
      return NextResponse.json({ error: "Expected `candidate` and `action`." }, { status: 400 });
    }
    await applyAction(body.candidate, body.action);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
