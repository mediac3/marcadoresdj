import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/event-auth";
import { recalculateScores } from "@/lib/event-scores";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth(request);
    if (error) return error;

    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      select: { id: true, scoreA: true, scoreB: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Recalculate and return fresh scores
    const scores = await recalculateScores(id);

    return NextResponse.json({
      success: true,
      eventId: id,
      scoreA: scores.scoreA,
      scoreB: scores.scoreB,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}