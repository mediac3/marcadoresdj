import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Public endpoint — returns only the total visit count.
 * Used by the footer visit counter on the public page (no auth required).
 */
export async function GET() {
  const totalVisits = await db.siteVisit.count();
  return NextResponse.json({ totalVisits });
}