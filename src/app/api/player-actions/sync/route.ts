import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSectionAccess } from "@/lib/event-auth";

/**
 * POST /api/player-actions/sync
 *
 * Idempotent backfill: creates PENDING CardPayments for every card
 * EventAction (SportAction with isCard=true) that doesn't have one yet.
 * Amount snapshots the current SportAction.cardAmount.
 */
export async function POST(request: Request) {
  try {
    const { error } = await requireSectionAccess(request, "payments", "edit");
    if (error) return error;

    const cardActions = await db.sportAction.findMany({
      where: { isCard: true },
      select: { name: true, sportId: true, cardAmount: true },
    });

    if (cardActions.length === 0) {
      return NextResponse.json({ success: true, created: 0 });
    }

    const cardTypeBySport = new Map<string, number>();
    for (const ca of cardActions) {
      cardTypeBySport.set(`${ca.sportId}:${ca.name}`, ca.cardAmount);
    }

    const events = await db.event.findMany({
      select: { id: true, sportId: true },
    });
    const sportByEvent = new Map(events.map((e) => [e.id, e.sportId]));

    const cardEventActions = await db.eventAction.findMany({
      where: { actionType: { in: cardActions.map((c) => c.name) } },
      select: {
        id: true,
        eventId: true,
        actionType: true,
        cardPayment: { select: { id: true } },
      },
    });

    let created = 0;
    for (const ea of cardEventActions) {
      if (ea.cardPayment) continue;
      const sportId = sportByEvent.get(ea.eventId);
      const amount = cardTypeBySport.get(`${sportId}:${ea.actionType}`) ?? 0;
      await db.cardPayment.create({
        data: { eventActionId: ea.id, amount, status: "PENDING" },
      });
      created++;
    }

    return NextResponse.json({ success: true, created });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
