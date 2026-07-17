import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/events/[id]/comments
 *
 * Public endpoint – no auth required.
 * Returns comments for a public event, ordered by newest first.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id, isPublic: true },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      );
    }

    const comments = await db.comment.findMany({
      where: { eventId: id },
      include: {
        user: {
          select: { id: true, username: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, comments });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}