import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string; shopId?: string };
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }

  return NextResponse.json(
    {
      id: crypto.randomUUID(),
      shopId: body.shopId ?? null,
      prompt: body.prompt.trim(),
      status: "building",
      provider: "mock",
      createdAt: new Date().toISOString(),
    },
    { status: 202 },
  );
}
