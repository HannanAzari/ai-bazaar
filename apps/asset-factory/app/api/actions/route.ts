import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { listActions } from "@/lib/server-candidates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    return NextResponse.json({ actions: await listActions() });
  } catch (err) {
    return serverError(err);
  }
}
