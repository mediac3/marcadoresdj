import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/events/[id]
 *
 * Public endpoint – no auth required.
 * Returns event detail with actions (player data including photo) and comments.
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

    return NextResponse.json({ success: true, event });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}