import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Phase types that form part of the elimination bracket
const BRACKET_PHASE_TYPES = [
  "ELIMINATORIA",
  "OCTAVOS",
  "CUARTOS",
  "SEMIFINAL",
  "FINAL",
  "TERCER_PUESTO",
] as const;

interface BracketMatch {
  id: string;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string | null;
  teamBName: string | null;
  teamALogo: string | null;
  teamBLogo: string | null;
  scoreA: number;
  scoreB: number;
  status: string;
  scheduledAt: string | null;
  homeSourceEventId: string | null;
  awaySourceEventId: string | null;
  round: number; // 0 = first round, increments for each subsequent phase
}

interface BracketRound {
  phaseId: string;
  phaseName: string;
  phaseType: string;
  order: number;
  matches: BracketMatch[];
}

/**
 * GET /api/public/tournaments/[id]/bracket
 * Public endpoint – no auth required.
 * Builds the elimination bracket tree for a tournament.
 * TERCER_PUESTO is returned separately.
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
          where: {
            isActive: true,
            type: { in: [...BRACKET_PHASE_TYPES] },
          },
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
                scheduledAt: true,
                homeSourceEventId: true,
                awaySourceEventId: true,
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

    // Separate TERCER_PUESTO from main bracket
    const mainPhases = tournament.phases.filter((p) => p.type !== "TERCER_PUESTO");
    const tercerPuestoPhase = tournament.phases.find((p) => p.type === "TERCER_PUESTO");

    // Build main bracket rounds
    const rounds: BracketRound[] = mainPhases.map((phase, idx) => ({
      phaseId: phase.id,
      phaseName: phase.name,
      phaseType: phase.type,
      order: phase.order,
      round: idx,
      matches: phase.events.map((e) => ({
        id: e.id,
        teamAId: e.teamAId,
        teamBId: e.teamBId,
        teamAName: e.teamA?.name ?? null,
        teamBName: e.teamB?.name ?? null,
        teamALogo: e.teamA?.logo ?? null,
        teamBLogo: e.teamB?.logo ?? null,
        scoreA: e.scoreA,
        scoreB: e.scoreB,
        status: e.status,
        scheduledAt: e.scheduledAt,
        homeSourceEventId: e.homeSourceEventId,
        awaySourceEventId: e.awaySourceEventId,
        round: idx,
      })),
    }));

    // Build third place match if exists
    let thirdPlaceMatch: BracketMatch | null = null;
    if (tercerPuestoPhase && tercerPuestoPhase.events.length > 0) {
      const e = tercerPuestoPhase.events[0];
      thirdPlaceMatch = {
        id: e.id,
        teamAId: e.teamAId,
        teamBId: e.teamBId,
        teamAName: e.teamA?.name ?? null,
        teamBName: e.teamB?.name ?? null,
        teamALogo: e.teamA?.logo ?? null,
        teamBLogo: e.teamB?.logo ?? null,
        scoreA: e.scoreA,
        scoreB: e.scoreB,
        status: e.status,
        scheduledAt: e.scheduledAt,
        homeSourceEventId: e.homeSourceEventId,
        awaySourceEventId: e.awaySourceEventId,
        round: -1,
      };
    }

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        logo: tournament.logo,
        sport: tournament.sport,
      },
      rounds,
      thirdPlaceMatch,
    });
  } catch (err) {
    console.error("[PUBLIC BRACKET ERROR]", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}