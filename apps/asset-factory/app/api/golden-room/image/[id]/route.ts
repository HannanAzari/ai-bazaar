import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { readImagePng } from "@/lib/golden-room-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a Golden Room candidate PNG from local persistence (.data/golden-room/images).
// Kept out of /public so generated candidates aren't bundled or committed.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const { id } = await ctx.params;
    const bytes = await readImagePng(id);
    if (!bytes) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return serverError(err);
  }
}
