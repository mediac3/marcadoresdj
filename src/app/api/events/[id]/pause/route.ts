import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireScoringAccess } from "@/lib/event-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await requireScoringAccess(request, id);
    if (error) return error;

    const event = await db.event.findUnique({
      where: { id },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (event.status !== "LIVE" && event.status !== "PAUSED") {
      return NextResponse.json(
        { error: "Event must be LIVE or PAUSED to toggle pause" },
        { status: 400 }
      );
    }

    const now = new Date();
    let newElapsedSeconds = event.elapsedSeconds;

    if (event.status === "LIVE") {
      // Pausing: save elapsed seconds
      if (event.startedAt) {
        // We don't have a "resumedAt" field, so we rely on the elapsedSeconds
        // already being tracked. The timer route handles the actual elapsed tracking.
      }
      const newStatus = "PAUSED";
      const updatedEvent = await db.event.update({
        where: { id },
        data: {
          status: newStatus,
        },
      });

      return NextResponse.json({ success: true, event: updatedEvent });
    } else {
      // Resuming: set back to LIVE
      const newStatus = "LIVE";
      const updatedEvent = await db.event.update({
        where: { id },
        data: {
          status: newStatus,
        },
      });

      return NextResponse.json({ success: true, event: updatedEvent });
    }
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}