import { type NextRequest, NextResponse } from "next/server";
import path from "path";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { saveApprovedAssets } from "@/lib/asset-persist-server";
import { type RoomEngineAsset } from "@/lib/export";

export const runtime = "nodejs"; // needs the filesystem
export const dynamic = "force-dynamic";

// Persist approved Style Lab room-engine assets to the app filesystem (V3.7.4):
// writes PNGs to public/generated/interior-v1 and merges the catalog under
// public/catalogs. Dry-run placeholders are skipped by the writer.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = (await req.json()) as { assets?: RoomEngineAsset[] };
    const assets = Array.isArray(body.assets) ? body.assets : [];
    const publicDir = path.join(process.cwd(), "public");
    const result = await saveApprovedAssets(assets, { publicDir });
    return NextResponse.json({
      saved: result.saved,
      skipped: result.skipped,
      catalogCount: result.catalogCount,
      generatedDir: "public/generated/interior-v1",
      catalogPath: "public/catalogs/nestudio-interior-v1.catalog.json",
    });
  } catch (err) {
    return serverError(err);
  }
}
