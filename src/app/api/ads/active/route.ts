import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventCityId = searchParams.get("cityId") || null;

  const activeAds = await db.ad.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  // Filter by location: if ad has cityIds set, only show it if event's city matches
  const filtered = activeAds.filter((ad) => {
    if (!ad.cityIds) return true; // No filter = show everywhere
    if (ad.cityIds.trim() === "") return true; // Empty = show everywhere
    if (!eventCityId) return true; // No event location filter = show all
    const allowedCities = ad.cityIds.split(",").map((c) => c.trim()).filter(Boolean);
    return allowedCities.includes(eventCityId);
  });

  // Increment displayCount for each filtered ad within a transaction
  if (filtered.length > 0) {
    await db.$transaction(
      filtered.map((ad) =>
        db.ad.update({
          where: { id: ad.id },
          data: { displayCount: { increment: 1 } },
        })
      )
    );
  }

  // Group by position
  const grouped: Record<string, typeof filtered> = {
    top: [],
    bottom: [],
    left: [],
    right: [],
  };

  for (const ad of filtered) {
    if (grouped[ad.position]) {
      grouped[ad.position].push(ad);
    }
  }

  return NextResponse.json({ success: true, ads: grouped });
}