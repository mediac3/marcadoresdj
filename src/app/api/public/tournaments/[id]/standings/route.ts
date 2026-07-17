import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/tournaments/[id]/standings
 * Public endpoint – no auth required.
 * Calculates standings for GRUPOS-type phases in a tournament.
 * Returns standings per group phase.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        logo: true,
        sport: { select: { id: true, name: true, icon: true } },
        phases: {
          where: { isActive: true, type: "GRUPOS" },
          select: {
            id: true,
            name: true,
            type: true,
            order: true,
            events: {
              where: { isPublic: true },
              select: {
                id: true,
                status: true,
                scoreA: true,
                scoreB: true,
                teamAId: true,
                teamBId: true,
                teamA: { select: { id: true, name: true, shortName: true, logo: true } },
                teamB: { select: { id: true, name: true, shortName: true, logo: true } },
              },
              orderBy: { scheduledAt: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // Calculate standings for each group phase
    const standings = tournament.phases.map((phase) => {
      const teamStats = new Map<
        string,
        {
          teamId: string;
          teamName: string;
          teamShortName: string | null;
          teamLogo: string | null;
          played: number;
          won: number;
          drawn: number;
          lost: number;
          goalsFor: number;
          goalsAgainst: number;
        }
      >();

      // Initialize teams from events
      for (const event of phase.events) {
        if (!teamStats.has(event.teamAId)) {
          teamStats.set(event.teamAId, {
            teamId: event.teamAId,
            teamName: event.teamA.name,
            teamShortName: event.teamA.shortName,
            teamLogo: event.teamA.logo,
            played: 0, won: 0, drawn: 0, lost: 0,
            goalsFor: 0, goalsAgainst: 0,
          });
        }
        if (!teamStats.has(event.teamBId)) {
          teamStats.set(event.teamBId, {
            teamId: event.teamBId,
            teamName: event.teamB.name,
            teamShortName: event.teamB.shortName,
            teamLogo: event.teamB.logo,
            played: 0, won: 0, drawn: 0, lost: 0,
            goalsFor: 0, goalsAgainst: 0,
          });
        }
      }

      // Process finished events
      for (const event of phase.events) {
        if (event.status !== "FINISHED") continue;

        const home = teamStats.get(event.teamAId)!;
        const away = teamStats.get(event.teamBId)!;

        home.played++;
        away.played++;
        home.goalsFor += event.scoreA;
        home.goalsAgainst += event.scoreB;
        away.goalsFor += event.scoreB;
        away.goalsAgainst += event.scoreA;

        if (event.scoreA > event.scoreB) {
          home.won++;
          away.lost++;
        } else if (event.scoreA < event.scoreB) {
          away.won++;
          home.lost++;
        } else {
          home.drawn++;
          away.drawn++;
        }
      }

      // Sort: Points desc, GD desc, GF desc, name asc
      const sorted = Array.from(teamStats.values()).sort((a, b) => {
        const ptsA = a.won * 3 + a.drawn;
        const ptsB = b.won * 3 + b.drawn;
        if (ptsB !== ptsA) return ptsB - ptsA;
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.teamName.localeCompare(b.teamName);
      });

      return {
        phaseId: phase.id,
        phaseName: phase.name,
        phaseOrder: phase.order,
        standings: sorted.map((t) => ({
          ...t,
          goalDifference: t.goalsFor - t.goalsAgainst,
          points: t.won * 3 + t.drawn,
        })),
      };
    });

    return NextResponse.json({ success: true, standings });
  } catch (err) {
    console.error("[PUBLIC STANDINGS ERROR]", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}