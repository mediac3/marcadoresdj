import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/tournaments?sportId=xxx
 * Public endpoint – no auth required.
 * Returns active tournaments with their phases and event counts.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sportId = searchParams.get("sportId");

    const where: Record<string, unknown> = { isActive: true };
    if (sportId) where.sportId = sportId;

    const tournaments = await db.tournament.findMany({
      where,
      select: {
        id: true,
        name: true,
        logo: true,
        location: true,
        startDate: true,
        endDate: true,
        sport: { select: { id: true, name: true, icon: true } },
        phases: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            type: true,
            order: true,
            _count: { select: { events: true } },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter out tournaments with no public events
    const tournamentsWithEvents = await Promise.all(
      tournaments.map(async (t) => {
        const eventCount = await db.event.count({
          where: {
            tournamentPhase: { tournamentId: t.id },
            isPublic: true,
          },
        });
        return { ...t, eventCount };
      })
    );

    // Only return tournaments that have at least 1 public event
    const filtered = tournamentsWithEvents.filter((t) => t.eventCount > 0);

    return NextResponse.json({ success: true, tournaments: filtered });
  } catch (err) {
    console.error("[PUBLIC TOURNAMENTS ERROR]", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}