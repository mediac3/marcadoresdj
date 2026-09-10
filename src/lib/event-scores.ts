import { db } from "@/lib/db";
import { computeScores } from "@/lib/score-computation";

/**
 * Recalculate scores for an event based on all its actions.
 *
 * Any EventAction where `value > 0` contributes to the score,
 * EXCEPT card actions (SportAction with isCard=true) — cards are
 * administrative/fine events and never add points.
 * The player's team determines which side gets the points.
 * OWN_GOAL is special: it contributes to the OPPOSITE team.
 *
 * The computation itself lives in `score-computation.ts` (pure, shared
 * with the offline client); this wrapper loads the data and persists.
 */
export async function recalculateScores(eventId: string): Promise<{ scoreA: number; scoreB: number }> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { teamAId: true, teamBId: true, sportId: true },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  // Card actions (payable cards) never contribute to the score
  const cardActions = await db.sportAction.findMany({
    where: { sportId: event.sportId, isCard: true },
    select: { name: true },
  });
  const cardTypes = new Set(cardActions.map((c) => c.name));

  const actions = await db.eventAction.findMany({
    where: {
      eventId,
      value: { gt: 0 },
    },
    include: {
      player: {
        select: { teamId: true },
      },
    },
  });

  const { scoreA, scoreB } = computeScores({
    actions,
    teamAId: event.teamAId,
    teamBId: event.teamBId,
    cardTypes,
  });

  await db.event.update({
    where: { id: eventId },
    data: { scoreA, scoreB },
  });

  return { scoreA, scoreB };
}
