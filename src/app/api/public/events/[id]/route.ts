import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeMatchMVP } from "@/lib/mvp";

/**
 * GET /api/public/events/[id]
 *
 * Public endpoint – no auth required.
 * Returns event detail with actions (player data including photo), comments
 * and the computed "Jugador del Partido" (MVP) from the match actions.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id, isPublic: true },
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        teamA: {
          include: {
            players: {
              select: {
                id: true,
                name: true,
                number: true,
                position: true,
                nickname: true,
                photo: true,
                birthDate: true,
                nationality: true,
                height: true,
                weight: true,
              },
              orderBy: { number: "asc" },
            },
          },
        },
        teamB: {
          include: {
            players: {
              select: {
                id: true,
                name: true,
                number: true,
                position: true,
                nickname: true,
                photo: true,
                birthDate: true,
                nationality: true,
                height: true,
                weight: true,
              },
              orderBy: { number: "asc" },
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
                position: true,
                nickname: true,
                teamId: true,
                photo: true,
                birthDate: true,
                nationality: true,
                height: true,
                weight: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        comments: {
          include: {
            user: {
              select: { id: true, username: true, name: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      );
    }

    // "Jugador del Partido" — weighted event rating from this match's actions.
    // Card detection uses the sport's real SportAction metadata (isCard).
    const sportActions = await db.sportAction.findMany({
      where: { sportId: event.sportId },
      select: { name: true, isCard: true },
    });
    const mvp = computeMatchMVP({
      actions: event.actions.map((a) => ({
        playerId: a.playerId,
        player: a.player
          ? {
              id: a.player.id,
              name: a.player.name,
              number: a.player.number,
              position: a.player.position,
              nickname: a.player.nickname,
              photo: a.player.photo,
              birthDate: a.player.birthDate,
              nationality: a.player.nationality,
              height: a.player.height,
              weight: a.player.weight,
              teamId: a.player.teamId,
            }
          : null,
        actionType: a.actionType,
        actionLabel: a.actionLabel,
        minute: a.minute,
        value: a.value,
      })),
      teamAId: event.teamAId,
      teamBId: event.teamBId,
      scoreA: event.scoreA,
      scoreB: event.scoreB,
      status: event.status,
      sportActions,
    });

    return NextResponse.json({ success: true, event, mvp });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}