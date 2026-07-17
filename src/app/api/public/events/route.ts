import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/events
 *
 * Public endpoint – no auth required.
 * Returns events where isPublic = true, grouped by tournament with actions (but NOT comments).
 * Now includes tournamentPhase relational data for richer grouping.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sportId = searchParams.get("sportId");
    const countryId = searchParams.get("countryId");
    const departmentId = searchParams.get("departmentId");
    const cityId = searchParams.get("cityId");
    const tournamentId = searchParams.get("tournamentId");

    const where: Record<string, unknown> = { isPublic: true };

    if (sportId) {
      where.sportId = sportId;
    }

    if (countryId) {
      where.countryId = countryId;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (cityId) {
      where.cityId = cityId;
    }

    if (tournamentId) {
      where.tournamentPhase = { tournamentId };
    }

    const events = await db.event.findMany({
      where,
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        teamA: {
          select: { id: true, name: true, shortName: true, logo: true, gender: true, ageCategory: true },
        },
        teamB: {
          select: { id: true, name: true, shortName: true, logo: true, gender: true, ageCategory: true },
        },
        country: {
          select: { id: true, name: true, code: true },
        },
        department: {
          select: { id: true, name: true },
        },
        city: {
          select: { id: true, name: true },
        },
        tournamentPhase: {
          select: {
            id: true,
            name: true,
            type: true,
            order: true,
            tournament: {
              select: {
                id: true,
                name: true,
                logo: true,
                sport: { select: { id: true, name: true, icon: true } },
              },
            },
          },
        },
        actions: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                number: true,
                nickname: true,
                teamId: true,
              },
            },
          },
          orderBy: { minute: "asc" },
        },
      },
      orderBy: [{ phaseOrder: "asc" }, { scheduledAt: "asc" }],
    });

    // Build tournament grouping using relational data (preferred) or legacy fallback
    interface TournamentGroup {
      id: string;
      name: string;
      logo: string | null;
      sport: { id: string; name: string; icon: string } | null;
      phases: {
        id: string;
        name: string;
        type: string;
        order: number;
        events: typeof events;
      }[];
    }

    const tournamentMap = new Map<string, TournamentGroup>();

    for (const event of events) {
      const phase = event.tournamentPhase;
      const tournament = phase?.tournament;

      if (tournament) {
        // Relational path
        let tGroup = tournamentMap.get(tournament.id);
        if (!tGroup) {
          tGroup = {
            id: tournament.id,
            name: tournament.name,
            logo: tournament.logo,
            sport: tournament.sport,
            phases: [],
          };
          tournamentMap.set(tournament.id, tGroup);
        }

        if (phase) {
          let pGroup = tGroup.phases.find((p) => p.id === phase.id);
          if (!pGroup) {
            pGroup = { id: phase.id, name: phase.name, type: phase.type, order: phase.order, events: [] };
            tGroup.phases.push(pGroup);
          }
          pGroup.events.push(event);
        }
      } else if (event.tournamentName) {
        // Legacy fallback: group by tournamentName string
        const legacyKey = `legacy:${event.tournamentName}`;
        let tGroup = tournamentMap.get(legacyKey);
        if (!tGroup) {
          tGroup = {
            id: legacyKey,
            name: event.tournamentName,
            logo: null,
            sport: event.sport,
            phases: [],
          };
          tournamentMap.set(legacyKey, tGroup);
        }

        const phaseName = event.phase || "Sin fase";
        let pGroup = tGroup.phases.find((p) => p.name === phaseName);
        if (!pGroup) {
          pGroup = { id: `legacy-phase:${phaseName}`, name: phaseName, type: "LEGACY", order: event.phaseOrder, events: [] };
          tGroup.phases.push(pGroup);
        }
        pGroup.events.push(event);
      }
    }

    // Sort phases within each tournament by order
    const tournaments = Array.from(tournamentMap.values()).map((t) => ({
      ...t,
      phases: t.phases.sort((a, b) => a.order - b.order),
    }));

    const nonTournamentEvents = events.filter(
      (e) => !e.tournamentPhase && !e.tournamentName
    );

    return NextResponse.json({
      success: true,
      events,
      tournaments: tournaments.length > 0 ? tournaments : undefined,
      nonTournamentEvents: nonTournamentEvents.length > 0 ? nonTournamentEvents : undefined,
    });
  } catch (err) {
    console.error('[PUBLIC EVENTS ERROR]', err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}