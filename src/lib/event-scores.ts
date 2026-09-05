import { db } from "@/lib/db";

/**
 * Recalculate scores for an event based on all its actions.
 *
 * Any EventAction where `value > 0` contributes to the score,
 * EXCEPT card actions (SportAction with isCard=true) — cards are
 * administrative/fine events and never add points.
 * The player's team determines which side gets the points.
 * OWN_GOAL is special: it contributes to the OPPOSITE team.
 *
 * This approach is fully dynamic — it works for any sport without
 * needing to hardcode action-type lists. The `defaultValue` on
 * SportAction determines how many points each click is worth.
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

  let scoreA = 0;
  let scoreB = 0;

  for (const action of actions) {
    // Cards don't score
    if (cardTypes.has(action.actionType)) continue;

    const value = action.value || 1;

    if (action.player) {
      if (action.actionType === "OWN_GOAL") {
        // Own goal counts for the OPPOSITE team
        if (action.player.teamId === event.teamAId) {
          scoreB += value;
        } else if (action.player.teamId === event.teamBId) {
          scoreA += value;
        }
      } else {
        // Regular scoring action - counts for the player's team
        if (action.player.teamId === event.teamAId) {
          scoreA += value;
        } else if (action.player.teamId === event.teamBId) {
          scoreB += value;
        }
      }
    }
  }

  await db.event.update({
    where: { id: eventId },
    data: { scoreA, scoreB },
  });

  return { scoreA, scoreB };
}