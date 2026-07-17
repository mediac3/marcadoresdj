import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireScoringAccess } from "@/lib/event-auth";
import { recalculateScores } from "@/lib/event-scores";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { id, actionId } = await params;

    const { error: authError } = await requireScoringAccess(request, id);
    if (authError) return authError;

    const event = await db.event.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const existingAction = await db.eventAction.findFirst({
      where: { id: actionId, eventId: id },
    });

    if (!existingAction) {
      return NextResponse.json(
        { error: "Action not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { value, minute } = body;

    const updateData: Record<string, unknown> = {};

    if (value !== undefined) {
      if (typeof value !== "number") {
        return NextResponse.json(
          { error: "value must be a number" },
          { status: 400 }
        );
      }
      updateData.value = value;
    }

    if (minute !== undefined) {
      if (typeof minute !== "number") {
        return NextResponse.json(
          { error: "minute must be a number" },
          { status: 400 }
        );
      }
      updateData.minute = minute;
    }

    const updatedAction = await db.eventAction.update({
      where: { id: actionId },
      data: updateData,
      include: {
        player: {
          select: {
            id: true,
            name: true,
            number: true,
            position: true,
            nickname: true,
            teamId: true,
          },
        },
      },
    });

    // Recalculate scores after updating action
    const scores = await recalculateScores(id);

    return NextResponse.json({ success: true, action: updatedAction, scores });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { id, actionId } = await params;

    const { error: authError } = await requireScoringAccess(request, id);
    if (authError) return authError;

    const event = await db.event.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const existingAction = await db.eventAction.findFirst({
      where: { id: actionId, eventId: id },
    });

    if (!existingAction) {
      return NextResponse.json(
        { error: "Action not found" },
        { status: 404 }
      );
    }

    await db.eventAction.delete({
      where: { id: actionId },
    });

    // Recalculate scores after deleting action
    const scores = await recalculateScores(id);

    return NextResponse.json({
      success: true,
      message: "Action deleted successfully",
      scores,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}