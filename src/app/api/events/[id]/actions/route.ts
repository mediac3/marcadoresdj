import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireScoringAccess } from "@/lib/event-auth";
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
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const actions = await db.eventAction.findMany({
      where: { eventId: id },
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, actions });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error: authError, payload } = await requireScoringAccess(request, id);
    if (authError) return authError;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        { error: "Event must be LIVE or PAUSED to add actions" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      playerId,
      actionType,
      actionLabel,
      actionIcon,
      actionColor,
      value,
      minute,
      half,
    } = body;

    if (!actionType || !actionLabel || !actionIcon) {
      return NextResponse.json(
        { error: "actionType, actionLabel, and actionIcon are required" },
        { status: 400 }
      );
    }

    // Validate player exists and belongs to one of the event's teams
    if (playerId) {
      const player = await db.player.findUnique({
        where: { id: playerId },
        select: { teamId: true },
      });

      if (!player) {
        return NextResponse.json(
          { error: "Player not found" },
          { status: 404 }
        );
      }

      if (player.teamId !== event.teamAId && player.teamId !== event.teamBId) {
        return NextResponse.json(
          { error: "Player does not belong to either team in this event" },
          { status: 400 }
        );
      }
    }

    const action = await db.eventAction.create({
      data: {
        eventId: id,
        playerId: playerId || null,
        actionType,
        actionLabel,
        actionIcon,
        actionColor: actionColor || "#ffffff",
        value: typeof value === "number" ? value : 1,
        minute: typeof minute === "number" ? minute : null,
        half: half || null,
        userId: payload.userId,
      },
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

    // Recalculate scores after creating action
    const scores = await recalculateScores(id);

    // If this action is a payable card, create its pending CardPayment.
    // Wrapped in try/catch: a payment issue must never break the scoring flow.
    try {
      const sportAction = await db.sportAction.findUnique({
        where: { name_sportId: { name: actionType, sportId: event.sportId } },
        select: { isCard: true, cardAmount: true },
      });
      if (sportAction?.isCard) {
        await db.cardPayment.create({
          data: {
            eventActionId: action.id,
            amount: sportAction.cardAmount,
            status: "PENDING",
          },
        });
      }
    } catch (err) {
      console.error("CardPayment creation failed (non-fatal):", err);
    }

    return NextResponse.json(
      { success: true, action, scores },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}