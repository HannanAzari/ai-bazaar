import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized } from "@/lib/api-auth";
import { getGenerationConfig } from "@/lib/generation-config";

export const dynamic = "force-dynamic";

// Returns the SAFE generation config (no token — `tokenConfigured` is a boolean).
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  return NextResponse.json({ config: getGenerationConfig() });
}
