import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { buildRoomShellPackExport, isWinner } from "@/lib/golden-room";
import { getCandidate } from "@/lib/golden-room-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Exports the chosen Golden Room as a RoomShellPack JSON. Any existing candidate id
// can be exported, but the response flags whether it actually clears the winner bar
// (approved + score ≥ 85) so we never silently ship a weak room.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const candidate = await getCandidate(id);
    if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

    const pack = buildRoomShellPackExport(candidate);
    return NextResponse.json(
      { pack, meetsBar: isWinner(candidate), score: candidate.score, dryRun: candidate.dryRun },
      { headers: { "Content-Disposition": 'attachment; filename="golden-room-v1.json"' } },
    );
  } catch (err) {
    return serverError(err);
  }
}
