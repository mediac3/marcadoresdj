import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/event-auth";

/**
 * GET /api/admin/event-access?userId=xxx
 * List all event access assignments, optionally filtered by userId.
 */
export async function GET(request: Request) {
  try {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const where = userId ? { userId } : {};

    const accessList = await db.eventAccess.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, name: true, role: true } },
        event: {
          select: {
            id: true,
            name: true,
            status: true,
            teamA: { select: { id: true, name: true, logo: true } },
            teamB: { select: { id: true, name: true, logo: true } },
            sport: { select: { id: true, name: true, icon: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, access: accessList });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/event-access
 * Body: { userId, eventId }
 * Assign an event to a user (initiator).
 */
export async function POST(request: Request) {
  try {
    const { error, payload } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const { userId, eventId } = body;

    if (!userId || !eventId) {
      return NextResponse.json({ error: "userId y eventId son requeridos" }, { status: 400 });
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verify event exists
    const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    // Upsert
    const access = await db.eventAccess.upsert({
      where: { userId_eventId: { userId, eventId } },
      update: {},
      create: {
        userId,
        eventId,
        assignedBy: payload!.userId,
      },
      include: {
        user: { select: { id: true, username: true, name: true, role: true } },
        event: {
          select: {
            id: true,
            name: true,
            status: true,
            teamA: { select: { id: true, name: true, logo: true } },
            teamB: { select: { id: true, name: true, logo: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, access }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}