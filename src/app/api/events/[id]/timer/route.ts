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
        { error: "Event must be LIVE or PAUSED to update timer" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { elapsedSeconds, half } = body;

    if (elapsedSeconds === undefined || typeof elapsedSeconds !== "number") {
      return NextResponse.json(
        { error: "elapsedSeconds (number) is required" },
        { status: 400 }
      );
    }

    if (elapsedSeconds < 0) {
      return NextResponse.json(
        { error: "elapsedSeconds must be non-negative" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      elapsedSeconds,
    };

    if (half !== undefined) {
      updateData.currentHalf = half;
    }

    const updatedEvent = await db.event.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, event: updatedEvent });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}