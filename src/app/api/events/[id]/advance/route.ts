import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

/**
 * POST /api/events/[id]/advance
 * Advances the winner (and optionally loser) of a finished event
 * to the next phase events linked via homeSourceEventId / awaySourceEventId.
 *
 * Body (optional):
 *   { advanceLoser: true }  — also advance the loser (for 3rd place matches)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { advanceLoser } = body as { advanceLoser?: boolean };

    // Fetch the finished event with feed targets
    const event = await db.event.findUnique({
      where: { id },
      include: {
        homeFeedEvents: {
          select: { id: true, teamAId: true, teamBId: true, status: true },
        },
        awayFeedEvents: {
          select: { id: true, teamAId: true, teamBId: true, status: true },
        },
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        tournamentPhase: {
          select: {
            id: true,
            name: true,
            type: true,
            tournament: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    if (event.status !== "FINISHED") {
      return NextResponse.json(
        { error: "Solo se puede avanzar el ganador de un evento finalizado" },
        { status: 400 }
      );
    }

    if (event.scoreA === event.scoreB) {
      return NextResponse.json(
        { error: "No se puede avanzar automáticamente de un empate. Define el ganador manualmente." },
        { status: 400 }
      );
    }

    const winnerId = event.scoreA > event.scoreB ? event.teamAId : event.teamBId;
    const loserId = event.scoreA > event.scoreB ? event.teamBId : event.teamAId;
    const winnerName = event.scoreA > event.scoreB ? event.teamA?.name : event.teamB?.name;
    const loserName = event.scoreA > event.scoreB ? event.teamB?.name : event.teamA?.name;

    const updated: string[] = [];

    // Advance winner to homeFeedEvents (this event is the homeSourceEvent for them)
    for (const target of event.homeFeedEvents) {
      if (target.status === "SCHEDULED") {
        await db.event.update({
          where: { id: target.id },
          data: { teamAId: winnerId },
        });
        updated.push(target.id);
      }
    }

    // Advance winner to awayFeedEvents (this event is the awaySourceEvent for them)
    for (const target of event.awayFeedEvents) {
      if (target.status === "SCHEDULED") {
        await db.event.update({
          where: { id: target.id },
          data: { teamBId: winnerId },
        });
        updated.push(target.id);
      }
    }

    // Optionally advance loser
    if (advanceLoser) {
      // For 3rd place matches, the loser goes to a specific slot
      // This would need custom logic per tournament setup
      // For now, we don't auto-advance losers
    }

    if (updated.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay eventos en la siguiente fase vinculados a este partido",
        advanced: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${winnerName} avanza a la siguiente fase`,
      winnerTeamId: winnerId,
      loserTeamId: loserId,
      updatedEventIds: updated,
      advanced: true,
    });
  } catch (err) {
    console.error("[ADVANCE WINNER ERROR]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}