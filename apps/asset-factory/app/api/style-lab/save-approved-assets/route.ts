import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { isServerSupabaseReady } from "@/lib/supabase-server";
import { uploadInteriorAsset } from "@/lib/server-storage";
import { saveCandidate } from "@/lib/server-candidates";
import { saveApprovedAssetsToSupabase } from "@/lib/asset-persist-server";
import { isSupabasePublicUrl } from "@/lib/asset-persist";
import { type AssetCandidate } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Persist approved real OpenAI Style Lab assets to Supabase (V3.7.5): upload each PNG
// to Storage (asset-candidates/interior-v1/<id>.png) and upsert the candidate row, so
// the main app / room engine can read them. Production target is Supabase — NOT the
// local filesystem.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  if (!isServerSupabaseReady()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and " +
          "SUPABASE_SERVICE_ROLE_KEY, run supabase/migrations, and create the 'asset-candidates' storage bucket.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as { assets?: AssetCandidate[] };
    const assets = Array.isArray(body.assets) ? body.assets : [];
    const result = await saveApprovedAssetsToSupabase(assets, {
      uploadImage: (bytes, contentType, id) => uploadInteriorAsset(bytes, contentType, id),
      upsertCandidate: saveCandidate,
      isSupabasePublicUrl,
    });
    return NextResponse.json({
      saved: result.saved,
      uploaded: result.uploaded,
      kept: result.kept,
      skipped: result.skipped,
      bucket: "asset-candidates/interior-v1",
    });
  } catch (err) {
    return serverError(err);
  }
}
