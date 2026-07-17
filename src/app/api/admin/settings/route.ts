import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

export async function GET() {
  const settings = await db.siteSetting.findMany();
  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const { error } = await requireCreatorOrAdmin(request);
  if (error) return error;

  const body: Record<string, string> = await request.json();

  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return NextResponse.json({ error: "Settings object is required" }, { status: 400 });
  }

  await db.$transaction(
    Object.entries(body).map(([key, value]) =>
      db.siteSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  );

  return NextResponse.json({ success: true });
}