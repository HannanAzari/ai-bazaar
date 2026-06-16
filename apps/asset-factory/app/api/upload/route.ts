import { type NextRequest, NextResponse } from "next/server";
import { isAuthorized, unauthorized, serverError } from "@/lib/api-auth";
import { uploadCandidateImage, decodeDataUrl } from "@/lib/server-storage";

export const dynamic = "force-dynamic";

// Accepts either a multipart file (field `file`) or a JSON `{ dataUrl, name }`.
// Returns the public URL of the stored image.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { dataUrl?: string; name?: string };
      if (!body.dataUrl) {
        return NextResponse.json({ error: "Expected `dataUrl`." }, { status: 400 });
      }
      const { bytes, contentType: imageType } = decodeDataUrl(body.dataUrl);
      const url = await uploadCandidateImage(bytes, imageType, body.name ?? "asset");
      return NextResponse.json({ url });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Expected a `file`." }, { status: 400 });
    }
    const url = await uploadCandidateImage(
      await file.arrayBuffer(),
      file.type,
      (form.get("name") as string) || file.name || "asset",
    );
    return NextResponse.json({ url });
  } catch (err) {
    return serverError(err);
  }
}
