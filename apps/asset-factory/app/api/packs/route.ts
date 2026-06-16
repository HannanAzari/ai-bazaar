import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { listPacks, savePack, deletePack } from "@/lib/server-candidates";
import { type AssetPack } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    return NextResponse.json({ packs: await listPacks() });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = (await req.json()) as { pack?: AssetPack };
    if (!body.pack) {
      return NextResponse.json({ error: "Expected `pack`." }, { status: 400 });
    }
    await savePack(body.pack);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Expected `id`." }, { status: 400 });
    await deletePack(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
