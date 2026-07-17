import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

  const result = await db.siteVisit.groupBy({
    by: ["fingerprint"],
    where: {
      createdAt: { gte: threeMinutesAgo },
    },
  });

  return NextResponse.json({ count: result.length });
}