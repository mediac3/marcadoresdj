import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

export async function GET(request: Request) {
  const { error } = await requireCreatorOrAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();

  // Total visits
  const totalVisits = await db.siteVisit.count({
    where: { createdAt: { gte: from, lte: to } },
  });

  // Unique visitors
  const uniqueVisitorsResult = await db.siteVisit.groupBy({
    by: ["fingerprint"],
    where: { createdAt: { gte: from, lte: to } },
  });
  const uniqueVisitors = uniqueVisitorsResult.length;

  // Total ad clicks
  const totalAdClicks = await db.adClick.count({
    where: { createdAt: { gte: from, lte: to } },
  });

  // Visits by day
  const visitsByDayRaw = await db.$queryRawUnsafe<
    { date: string; count: bigint }[]
  >(
    `SELECT date(createdAt) as date, COUNT(*) as count
     FROM SiteVisit
     WHERE createdAt >= ? AND createdAt <= ?
     GROUP BY date(createdAt)
     ORDER BY date(createdAt)`,
    from.toISOString(),
    to.toISOString()
  );
  const visitsByDay = visitsByDayRaw.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));

  // Visits by country
  const visitsByCountryRaw = await db.siteVisit.groupBy({
    by: ["country"],
    where: {
      createdAt: { gte: from, lte: to },
      country: { not: null },
    },
    _count: { country: true },
    orderBy: { _count: { country: "desc" } },
  });
  const visitsByCountry = visitsByCountryRaw.map((r) => ({
    country: r.country || "Unknown",
    count: r._count.country,
  }));

  // Visits by browser
  const visitsByBrowserRaw = await db.siteVisit.groupBy({
    by: ["browser"],
    where: {
      createdAt: { gte: from, lte: to },
      browser: { not: null },
    },
    _count: { browser: true },
    orderBy: { _count: { browser: "desc" } },
  });
  const visitsByBrowser = visitsByBrowserRaw.map((r) => ({
    browser: r.browser || "Unknown",
    count: r._count.browser,
  }));

  // Visits by device
  const visitsByDeviceRaw = await db.siteVisit.groupBy({
    by: ["deviceType"],
    where: {
      createdAt: { gte: from, lte: to },
      deviceType: { not: null },
    },
    _count: { deviceType: true },
    orderBy: { _count: { deviceType: "desc" } },
  });
  const visitsByDevice = visitsByDeviceRaw.map((r) => ({
    deviceType: r.deviceType || "Unknown",
    count: r._count.deviceType,
  }));

  // Ad clicks by ad
  const adClicksByAdRaw = await db.adClick.groupBy({
    by: ["adId"],
    where: { createdAt: { gte: from, lte: to } },
    _count: { adId: true },
    orderBy: { _count: { adId: "desc" } },
  });

  const adClicksByAd = await Promise.all(
    adClicksByAdRaw.map(async (r) => {
      const ad = await db.ad.findUnique({
        where: { id: r.adId },
        select: { title: true },
      });
      return {
        adId: r.adId,
        title: ad?.title || "Unknown",
        clicks: r._count.adId,
      };
    })
  );

  return NextResponse.json({
    totalVisits,
    uniqueVisitors,
    totalAdClicks,
    visitsByDay,
    visitsByCountry,
    visitsByBrowser,
    visitsByDevice,
    adClicksByAd,
  });
}