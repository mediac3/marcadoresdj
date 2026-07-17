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

    if (event.status === "SCHEDULED") {
      return NextResponse.json(
        { error: "Cannot end a scheduled event" },
        { status: 400 }
      );
    }

    if (event.status === "FINISHED") {
      return NextResponse.json(
        { error: "Event is already finished" },
        { status: 400 }
      );
    }

    const updatedEvent = await db.event.update({
      where: { id },
      data: {
        status: "FINISHED",
        endedAt: new Date(),
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