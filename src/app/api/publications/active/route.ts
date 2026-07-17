import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Public endpoint — returns active publications ordered by `order` asc, then `createdAt` desc.
 */
export async function GET() {
  const publications = await db.publication.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ success: true, publications });
}