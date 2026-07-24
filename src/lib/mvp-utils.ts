/**
 * MVP (Jugador del Partido) calculation utilities.
 *
 * The MVP is computed client-side from the event actions and the sport's
 * action definitions. Each SportAction has an `mvpWeight` (+sums, -subtracts
 * from a base of 10). The player with the highest clamped score wins.
 *
 * Formula:  score = clamp(10 + Σ(mvpWeight × value), 1, 10)
 */

/** Minimum input shape for an action — works with both EventAction and PublicEventAction. */
interface MVPAction {
  playerId: string | null;
  actionType: string;
  value: number;
  player?: {
    id: string;
    name: string;
    number: number;
    nickname?: string | null;
    photo?: string | null;
    teamId?: string;
  } | null;
}

/** Minimum input shape for a sport action definition. */
interface MVPSportAction {
  name: string;
  mvpWeight: number;
}

export interface MVPResult {
  playerId: string;
  playerName: string;
  playerNumber: number;
  playerPhoto: string | null;
  teamId: string | undefined;
  score: number; // clamped to [1, 10]
}

/**
 * Build a lookup map: actionType → mvpWeight.
 * Falls back to 0 for unknown action types.
 */
export function buildMvpWeightMap(
  sportActions: MVPSportAction[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of sportActions) {
    map.set(a.name, a.mvpWeight ?? 0);
  }
  return map;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute the MVP (Jugador del Partido) for a set of event actions.
 *
 * @param actions     Recorded event actions (with embedded player info)
 * @param sportActions Sport action definitions (with mvpWeight)
 * @returns The player with the highest MVP score, or null if no actions have a player.
 */
export function calculateMVP(
  actions: MVPAction[],
  sportActions: MVPSportAction[],
): MVPResult | null {
  if (!actions || actions.length === 0) return null;

  const weightMap = buildMvpWeightMap(sportActions);

  // Accumulate raw delta per player
  const deltas = new Map<string, number>();
  // Keep a reference player record per player (use the first action that references them)
  const players = new Map<
    string,
    { name: string; number: number; photo: string | null; teamId: string | undefined }
  >();

  for (const action of actions) {
    if (!action.playerId) continue;
    const weight = weightMap.get(action.actionType) ?? 0;
    if (weight === 0) continue; // action doesn't influence MVP

    const contribution = weight * action.value;
    deltas.set(action.playerId, (deltas.get(action.playerId) ?? 0) + contribution);

    if (!players.has(action.playerId) && action.player) {
      players.set(action.playerId, {
        name: action.player.name,
        number: action.player.number,
        photo: action.player.photo ?? null,
        teamId: action.player.teamId,
      });
    }
  }

  if (deltas.size === 0) return null;

  // Find the player with the highest delta (ties broken by first-seen order)
  let bestId: string | null = null;
  let bestDelta = -Infinity;
  for (const [playerId, delta] of deltas) {
    if (delta > bestDelta) {
      bestDelta = delta;
      bestId = playerId;
    }
  }

  if (!bestId) return null;
  const player = players.get(bestId);
  if (!player) return null;

  return {
    playerId: bestId,
    playerName: player.name,
    playerNumber: player.number,
    playerPhoto: player.photo,
    teamId: player.teamId,
    score: clamp(10 + bestDelta, 1, 10),
  };
}
