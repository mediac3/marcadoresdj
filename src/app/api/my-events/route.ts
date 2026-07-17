import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireInitiatorOrAbove } from "@/lib/event-auth";

/**
 * GET /api/my-events — Events accessible to the current user
 * - ADMIN: all events
 * - CREATOR: events they created
 * - INITIATOR: events assigned via EventAccess
 */
export async function GET(request: Request) {
  try {
    const { error, payload } = await requireInitiatorOrAbove(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let events;

    if (payload.role === "ADMIN") {
      events = await db.event.findMany({
        include: {
          sport: { select: { id: true, name: true, icon: true } },
          teamA: { select: { id: true, name: true, shortName: true, logo: true } },
          teamB: { select: { id: true, name: true, shortName: true, logo: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (payload.role === "CREATOR") {
      events = await db.event.findMany({
        where: { createdById: payload.userId },
        include: {
          sport: { select: { id: true, name: true, icon: true } },
          teamA: { select: { id: true, name: true, shortName: true, logo: true } },
          teamB: { select: { id: true, name: true, shortName: true, logo: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // INITIATOR: events via EventAccess
      const accesses = await db.eventAccess.findMany({
        where: { userId: payload.userId },
        include: {
          event: {
            include: {
              sport: { select: { id: true, name: true, icon: true } },
              teamA: { select: { id: true, name: true, shortName: true, logo: true } },
              teamB: { select: { id: true, name: true, shortName: true, logo: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      events = accesses.map((a) => a.event);
    }

    return NextResponse.json({ success: true, events });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}