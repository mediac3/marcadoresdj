import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

export async function GET(request: Request) {
  try {
    const { error } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query param is required" },
        { status: 400 }
      );
    }

    const accesses = await db.eventAccess.findMany({
      where: { userId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            status: true,
            teamA: { select: { name: true } },
            teamB: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      accesses: accesses.map((a) => ({
        id: a.id,
        userId: a.userId,
        eventId: a.eventId,
        createdAt: a.createdAt,
        event: {
          id: a.event.id,
          name: a.event.name,
          teamA: a.event.teamA.name,
          teamB: a.event.teamB.name,
          status: a.event.status,
        },
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const body = await request.json();
    const { userId, eventId } = body as { userId: string; eventId: string };

    if (!userId || !eventId) {
      return NextResponse.json(
        { error: "userId and eventId are required" },
        { status: 400 }
      );
    }

    const access = await db.eventAccess.create({
      data: { userId, eventId },
    });

    return NextResponse.json({ success: true, access });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { error } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const eventId = searchParams.get("eventId");

    if (!userId || !eventId) {
      return NextResponse.json(
        { error: "userId and eventId query params are required" },
        { status: 400 }
      );
    }

    await db.eventAccess.deleteMany({
      where: { userId, eventId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}