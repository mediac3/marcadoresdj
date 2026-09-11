import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { predictMatch, type HistoryMatch } from "@/lib/prediction";

/**
 * GET /api/public/events/[id]/prediction
 *
 * Public endpoint – no auth required, read-only.
 * Win/Draw/Win (1X2) probabilities for an event based on each team's
 * historical results (finished public matches of the same sport), computed
 * with the Dixon-Coles model (see src/lib/prediction.ts).
 */

/** History cap per team (most recent first). */
const TEAM_HISTORY_LIMIT = 15;

function toHistoryMatch(e: {
  id: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  endedAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
}): HistoryMatch {
  const when = e.endedAt ?? e.scheduledAt ?? e.createdAt;
  return {
    id: e.id,
    teamAId: e.teamAId,
    teamBId: e.teamBId,
    scoreA: e.scoreA,
    scoreB: e.scoreB,
    playedAt: when ? new Date(when).getTime() : null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id, isPublic: true },
      select: {
        id: true,
        status: true,
        scoreA: true,
        scoreB: true,
        elapsedSeconds: true,
        sportId: true,
        sport: { select: { name: true } },
        teamAId: true,
        teamBId: true,
        teamA: { select: { id: true, name: true, shortName: true } },
        teamB: { select: { id: true, name: true, shortName: true } },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      );
    }

    // Previous finished matches for either team (same sport, public, not this one).
    const history = await db.event.findMany({
      where: {
        status: "FINISHED",
        isPublic: true,
        sportId: event.sportId,
        id: { not: event.id },
        OR: [
          { teamAId: event.teamAId },
          { teamAId: event.teamBId },
          { teamBId: event.teamAId },
          { teamBId: event.teamBId },
        ],
      },
      select: {
        id: true,
        teamAId: true,
        teamBId: true,
        scoreA: true,
        scoreB: true,
        endedAt: true,
        scheduledAt: true,
        createdAt: true,
      },
      orderBy: [{ endedAt: "desc" }, { scheduledAt: "desc" }],
      take: TEAM_HISTORY_LIMIT * 4,
    });

    const matchesA = history
      .filter((e) => e.teamAId === event.teamAId || e.teamBId === event.teamAId)
      .slice(0, TEAM_HISTORY_LIMIT)
      .map(toHistoryMatch);
    const matchesB = history
      .filter((e) => e.teamAId === event.teamBId || e.teamBId === event.teamBId)
      .slice(0, TEAM_HISTORY_LIMIT)
      .map(toHistoryMatch);

    // League average for the sport (finished public matches).
    const sportAgg = await db.event.aggregate({
      where: { status: "FINISHED", isPublic: true, sportId: event.sportId },
      _count: { _all: true },
      _sum: { scoreA: true, scoreB: true },
    });

    const prediction = predictMatch({
      sportName: event.sport.name,
      teamA: { teamId: event.teamAId, matches: matchesA },
      teamB: { teamId: event.teamBId, matches: matchesB },
      sportSample: {
        matches: sportAgg._count._all,
        totalGoals: (sportAgg._sum.scoreA ?? 0) + (sportAgg._sum.scoreB ?? 0),
      },
      status: event.status,
      scoreA: event.scoreA,
      scoreB: event.scoreB,
      elapsedSeconds: event.elapsedSeconds,
    });

    return NextResponse.json({
      success: true,
      eventId: event.id,
      teams: {
        teamA: { id: event.teamA.id, name: event.teamA.name, shortName: event.teamA.shortName },
        teamB: { id: event.teamB.id, name: event.teamB.name, shortName: event.teamB.shortName },
      },
      prediction,
    });
  } catch (err) {
    console.error("[PUBLIC PREDICTION ERROR]", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
