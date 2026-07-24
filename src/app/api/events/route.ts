import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireCreatorOrAdmin } from "@/lib/event-auth";

export async function GET(request: NextRequest) {
  try {
    const { error, payload } = await requireAuth(request);
    if (error) return error;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const sportId = searchParams.get("sportId");
    const isPublicParam = searchParams.get("isPublic");
    const tournamentName = searchParams.get("tournamentName");
    const phase = searchParams.get("phase");

    const where: Record<string, unknown> = {};

    // CREATOR isolation: only see own events
    if (payload && payload.role === "CREATOR") {
      where.createdById = payload.userId;
    }

    if (status) {
      where.status = status;
    }

    if (sportId) {
      where.sportId = sportId;
    }

    if (isPublicParam !== null) {
      where.isPublic = isPublicParam === "true";
    }

    if (tournamentName) {
      where.tournamentName = tournamentName;
    }

    if (phase) {
      where.phase = phase;
    }

    const events = await db.event.findMany({
      where,
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        teamA: {
          include: {
            players: {
              select: { id: true, name: true, number: true, position: true, nickname: true },
              orderBy: { number: "asc" },
            },
          },
        },
        teamB: {
          include: {
            players: {
              select: { id: true, name: true, number: true, position: true, nickname: true },
              orderBy: { number: "asc" },
            },
          },
        },
        actions: {
          select: {
            id: true,
            playerId: true,
            actionType: true,
            value: true,
            player: {
              select: {
                id: true,
                name: true,
                number: true,
                nickname: true,
                photo: true,
                teamId: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, events });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      sportId,
      teamAId,
      teamBId,
      location,
      countryId,
      departmentId,
      cityId,
      scheduledAt,
      streamingUrl,
      streamingKey,
      isPublic,
      tournamentName,
      phase,
      phaseOrder,
      tournamentPhaseId,
    } = body;

    if (!sportId || !teamAId || !teamBId) {
      return NextResponse.json(
        { error: "sportId, teamAId, and teamBId are required" },
        { status: 400 }
      );
    }

    // Validate sport exists
    const sport = await db.sport.findUnique({
      where: { id: sportId },
    });
    if (!sport) {
      return NextResponse.json(
        { error: "Sport not found" },
        { status: 404 }
      );
    }

    // Validate teams exist and belong to the same sport
    const [teamA, teamB] = await Promise.all([
      db.team.findUnique({ where: { id: teamAId } }),
      db.team.findUnique({ where: { id: teamBId } }),
    ]);

    if (!teamA) {
      return NextResponse.json(
        { error: "Team A not found" },
        { status: 404 }
      );
    }

    if (!teamB) {
      return NextResponse.json(
        { error: "Team B not found" },
        { status: 404 }
      );
    }

    if (teamA.sportId !== sportId || teamB.sportId !== sportId) {
      return NextResponse.json(
        { error: "Teams must belong to the specified sport" },
        { status: 400 }
      );
    }

    if (teamA.id === teamB.id) {
      return NextResponse.json(
        { error: "Team A and Team B must be different" },
        { status: 400 }
      );
    }

    // ── Resolve tournament phase + sync legacy fields ──
    let resolvedTournamentName = tournamentName || null;
    let resolvedPhase = phase || null;
    let resolvedPhaseOrder = phaseOrder !== undefined ? phaseOrder : 0;
    let resolvedPhaseId: string | null = tournamentPhaseId || null;

    if (resolvedPhaseId) {
      // Relational path: fetch the phase and sync legacy fields from it
      const phaseRecord = await db.tournamentPhase.findUnique({
        where: { id: resolvedPhaseId },
        include: { tournament: { select: { name: true } } },
      });
      if (phaseRecord) {
        resolvedTournamentName = phaseRecord.tournament.name;
        resolvedPhase = phaseRecord.name;
        resolvedPhaseOrder = phaseRecord.order;
      } else {
        resolvedPhaseId = null; // phase not found, fall back to legacy
      }
    }

    const event = await db.event.create({
      data: {
        name: name || null,
        sportId,
        teamAId,
        teamBId,
        location: location || null,
        countryId: countryId || null,
        departmentId: departmentId || null,
        cityId: cityId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        streamingUrl: streamingUrl || null,
        streamingKey: streamingKey || null,
        isPublic: isPublic !== undefined ? isPublic : true,
        status: "SCHEDULED",
        createdById: payload.userId,
        // Legacy fields (always populated for backward compat)
        tournamentName: resolvedTournamentName,
        phase: resolvedPhase,
        phaseOrder: resolvedPhaseOrder,
        // New relational field
        tournamentPhaseId: resolvedPhaseId,
      },
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        teamA: {
          include: {
            players: {
              select: { id: true, name: true, number: true, position: true, nickname: true },
              orderBy: { number: "asc" },
            },
          },
        },
        teamB: {
          include: {
            players: {
              select: { id: true, name: true, number: true, position: true, nickname: true },
              orderBy: { number: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}