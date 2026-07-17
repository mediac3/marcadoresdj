import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";
import { PHASE_ORDER } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "events array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (events.length > 100) {
      return NextResponse.json(
        { error: "Maximo 100 eventos por importacion" },
        { status: 400 }
      );
    }

    // Pre-fetch all sports and teams for lookup
    const allSports = await db.sport.findMany({
      select: { id: true, name: true },
    });
    const allTeams = await db.team.findMany({
      select: { id: true, name: true, sportId: true },
    });

    const sportMap = new Map(allSports.map((s) => [s.name.toLowerCase(), s.id]));
    const teamMap = new Map(allTeams.map((t) => [t.name.toLowerCase(), { id: t.id, sportId: t.sportId }]));

    const results: { row: number; error: string }[] = [];
    const created: unknown[] = [];

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const rowNum = i + 2; // Excel row number (1 = header)

      // ── Validate required fields ──
      const sportName = String(ev.sportName || "").trim();
      const teamAName = String(ev.teamAName || "").trim();
      const teamBName = String(ev.teamBName || "").trim();

      if (!sportName) {
        results.push({ row: rowNum, error: "Deporte es requerido" });
        continue;
      }
      if (!teamAName) {
        results.push({ row: rowNum, error: "Equipo Local es requerido" });
        continue;
      }
      if (!teamBName) {
        results.push({ row: rowNum, error: "Equipo Visitante es requerido" });
        continue;
      }

      // ── Resolve sport ──
      const sportId = sportMap.get(sportName.toLowerCase());
      if (!sportId) {
        results.push({ row: rowNum, error: `Deporte "${sportName}" no encontrado` });
        continue;
      }

      // ── Resolve teams ──
      const teamA = teamMap.get(teamAName.toLowerCase());
      if (!teamA) {
        results.push({ row: rowNum, error: `Equipo Local "${teamAName}" no encontrado` });
        continue;
      }
      const teamB = teamMap.get(teamBName.toLowerCase());
      if (!teamB) {
        results.push({ row: rowNum, error: `Equipo Visitante "${teamBName}" no encontrado` });
        continue;
      }

      // Teams must belong to the same sport
      if (teamA.sportId !== sportId) {
        results.push({ row: rowNum, error: `"${teamAName}" no pertenece al deporte "${sportName}"` });
        continue;
      }
      if (teamB.sportId !== sportId) {
        results.push({ row: rowNum, error: `"${teamBName}" no pertenece al deporte "${sportName}"` });
        continue;
      }
      if (teamA.id === teamB.id) {
        results.push({ row: rowNum, error: "Equipo Local y Visitante deben ser diferentes" });
        continue;
      }

      // ── Optional fields ──
      const name = ev.name ? String(ev.name).trim() : null;
      const location = ev.location ? String(ev.location).trim() : null;
      const tournamentName = ev.tournamentName ? String(ev.tournamentName).trim() : null;
      const phase = ev.phase ? String(ev.phase).trim() : null;
      const phaseOrder = phase ? (PHASE_ORDER[phase] ?? 0) : 0;
      const isPublic = ev.isPublic !== undefined ? Boolean(ev.isPublic) : true;

      // Parse scheduledAt
      let scheduledAt: Date | null = null;
      if (ev.scheduledAt) {
        const d = new Date(String(ev.scheduledAt));
        if (!isNaN(d.getTime())) {
          scheduledAt = d;
        }
      }

      try {
        const event = await db.event.create({
          data: {
            name,
            sportId,
            teamAId: teamA.id,
            teamBId: teamB.id,
            location,
            scheduledAt,
            tournamentName,
            phase,
            phaseOrder,
            isPublic,
            createdById: payload.userId,
            status: "SCHEDULED",
          },
          include: {
            sport: { select: { id: true, name: true, icon: true } },
            teamA: { select: { id: true, name: true, shortName: true } },
            teamB: { select: { id: true, name: true, shortName: true } },
          },
        });
        created.push(event);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        results.push({ row: rowNum, error: msg });
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: results.length,
      results,
      events: created,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}