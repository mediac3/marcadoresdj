/**
 * Pure score computation shared by the server (recalculateScores) and
 * the offline client (optimistic local scores while disconnected).
 *
 * Rules (identical to the original server implementation):
 * - Actions with value > 0 contribute to the score.
 * - Card actions (SportAction.isCard) NEVER contribute — they are
 *   administrative/fine events.
 * - The player's team decides which side scores; OWN_GOAL scores for
 *   the OPPOSITE team.
 */

export interface ScoreComputationAction {
  actionType: string;
  value: number;
  player?: { teamId: string } | null;
}

export interface ScoreComputationInput {
  actions: ScoreComputationAction[];
  teamAId: string | null;
  teamBId: string | null;
  /** Names of card action types for the event's sport (they never score). */
  cardTypes: Set<string>;
}

export function computeScores(input: ScoreComputationInput): {
  scoreA: number;
  scoreB: number;
} {
  let scoreA = 0;
  let scoreB = 0;

  for (const action of input.actions) {
    if (action.value <= 0) continue;

    // Cards don't score
    if (input.cardTypes.has(action.actionType)) continue;

    const value = action.value || 1;

    if (action.player) {
      if (action.actionType === 'OWN_GOAL') {
        // Own goal counts for the OPPOSITE team
        if (action.player.teamId === input.teamAId) {
          scoreB += value;
        } else if (action.player.teamId === input.teamBId) {
          scoreA += value;
        }
      } else {
        // Regular scoring action — counts for the player's team
        if (action.player.teamId === input.teamAId) {
          scoreA += value;
        } else if (action.player.teamId === input.teamBId) {
          scoreB += value;
        }
      }
    }
  }

  return { scoreA, scoreB };
}
