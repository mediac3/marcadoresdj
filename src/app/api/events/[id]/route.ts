import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireEventCreatorOrAdmin } from "@/lib/event-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, payload } = await requireAuth(request);
    if (error) return error;

    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        teamA: {
          include: {
            players: {
              select: { id: true, name: true, number: true, position: true, nickname: true, photo: true },
              orderBy: { number: "asc" },
            },
          },
        },
        teamB: {
          include: {
            players: {
              select: { id: true, name: true, number: true, position: true, nickname: true, photo: true },
              orderBy: { number: "asc" },
            },
          },
        },
        actions: {
          include: {
            player: {
              select: { id: true, name: true, number: true, position: true, nickname: true, teamId: true },
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
          orderBy: { createdAt: "desc" },
        },
        createdBy: {
          select: { id: true, username: true, name: true, role: true },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // CREATOR isolation: only access own events
    if (payload && payload.role === "CREATOR" && event.createdById !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, event });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingEvent = await db.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const { error, payload } = await requireEventCreatorOrAdmin(request, existingEvent);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
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
    } = body;

    // Build update data - allow all specified fields
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (countryId !== undefined) updateData.countryId = countryId || null;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (cityId !== undefined) updateData.cityId = cityId || null;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (streamingUrl !== undefined) updateData.streamingUrl = streamingUrl;
    if (streamingKey !== undefined) updateData.streamingKey = streamingKey;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (tournamentName !== undefined) updateData.tournamentName = tournamentName;
    if (phase !== undefined) updateData.phase = phase;
    if (phaseOrder !== undefined) updateData.phaseOrder = phaseOrder;

    const updatedEvent = await db.event.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ success: true, event: updatedEvent });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingEvent = await db.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Allow ADMIN or event CREATOR to delete
    const { error } = await requireEventCreatorOrAdmin(request, existingEvent);
    if (error) return error;

    await db.event.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}