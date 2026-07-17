import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

/**
 * GET /api/events/[id]/initiators — List initiators assigned to an event
 * Only ADMIN or CREATOR (who created the event) can manage initiators
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // CREATOR can only manage their own events
    const event = await db.event.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (payload.role === "CREATOR" && event.createdById !== payload.userId) {
      return NextResponse.json({ error: "Solo puedes gestionar tus propios eventos" }, { status: 403 });
    }

    const accesses = await db.eventAccess.findMany({
      where: { eventId: id },
      include: {
        user: {
          select: { id: true, username: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, initiators: accesses });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/events/[id]/initiators — Assign an initiator to an event
 * Body: { userId: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (payload.role === "CREATOR" && event.createdById !== payload.userId) {
      return NextResponse.json({ error: "Solo puedes gestionar tus propios eventos" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Verify target user exists and is INITIATOR
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      return NextResponse.json({ error: "Usuario no encontrado o inactivo" }, { status: 404 });
    }

    if (targetUser.role !== "INITIATOR") {
      return NextResponse.json({ error: "Solo se puede asignar usuarios con rol Iniciador" }, { status: 400 });
    }

    const access = await db.eventAccess.create({
      data: {
        eventId: id,
        userId,
        assignedBy: payload.userId,
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json({ success: true, access }, { status: 201 });
  } catch (e: unknown) {
    // Handle unique constraint violation
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Este iniciador ya tiene acceso a este evento" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/events/[id]/initiators — Remove an initiator from an event
 * Body: { userId: string }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (payload.role === "CREATOR" && event.createdById !== payload.userId) {
      return NextResponse.json({ error: "Solo puedes gestionar tus propios eventos" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await db.eventAccess.deleteMany({
      where: { eventId: id, userId },
    });

    return NextResponse.json({ success: true, message: "Acceso eliminado" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}