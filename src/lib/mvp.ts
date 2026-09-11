/**
 * MVP — "Jugador del Partido" (player of the match)
 *
 * Deterministic, event-based weighted performance rating computed from the
 * match's own EventActions. The weights follow the style of the performance
 * indexes used by federations and sports media (weighted event rating):
 * decisive scoring actions dominate, disciplinary actions penalize, and the
 * winning side gets a small bonus. Because weights are only ever compared
 * between players of the SAME match, the ranking is fair across sports
 * (fútbol, baloncesto, voleibol, ...).
 *
 * Scoring detection mirrors src/lib/score-computation.ts (the scoreboard's
 * source of truth): an action scores when value > 0 AND it is not a card
 * (SportAction.isCard metadata from the sport, with a name/label fallback
 * for custom actions without metadata).
 */

/* ── Inputs ────────────────────────────────────────────────────────────────── */

export interface MvpActionPlayer {
  id: string;
  name: string;
  number: number;
  position?: string | null;
  nickname?: string | null;
  photo?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  height?: string | null;
  weight?: string | null;
  teamId: string;
}

export interface MvpAction {
  playerId: string | null;
  player: MvpActionPlayer | null;
  actionType: string;
  actionLabel: string;
  minute: number | null;
  value: number;
}

/** Minimal SportAction metadata used to tell cards from scoring actions. */
export interface MvpSportActionMeta {
  name: string;
  isCard: boolean;
}

export interface MvpInput {
  actions: MvpAction[];
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  /** SCHEDULED | LIVE | PAUSED | FINISHED — during LIVE/PAUSED the current
   *  leader receives the winner bonus as well. */
  status: string;
  sportActions: MvpSportActionMeta[];
}

/* ── Outputs ───────────────────────────────────────────────────────────────── */

export interface MvpBreakdown {
  goals: number; // total scoring value (goals / points / canastas)
  ownGoals: number;
  yellowCards: number;
  blueCards: number; // futsal 2-min card
  redCards: number;
}

export interface MvpEntry {
  playerId: string;
  playerName: string;
  playerNumber: number | null;
  playerNickname: string | null;
  playerPhoto: string | null;
  playerPosition: string | null;
  playerBirthDate: string | null;
  playerNationality: string | null;
  playerHeight: string | null;
  playerWeight: string | null;
  teamId: string;
  /** Weighted rating points (integer scale, only used for ranking). */
  points: number;
  /** Cosmetic 1–10 rating derived from points (display only). */
  rating: number;
  breakdown: MvpBreakdown;
  /** Minute of the player's first scoring action (tie-breaker, display). */
  firstGoalMinute: number | null;
}

export interface MvpResult {
  mvp: MvpEntry;
  podium: MvpEntry[]; // best up to 3 (MVP included)
}

/* ── Weights ───────────────────────────────────────────────────────────────── */

const WEIGHTS = {
  /** Points per unit of scoring value (goal = 10 rating points). */
  scoring: 10,
  /** Points per unit of own-goal value (scores for the rival). */
  ownGoal: -10,
  /** Disciplinary penalties. */
  yellowCard: -2,
  blueCard: -1,
  redCard: -6,
  genericCard: -2,
  /** Bonus for scorers on the winning / leading team. */
  winnerBonus: 1.5,
} as const;

/** Rating displayed on a 1–10 scale: base 6 + 0.35 × points, clamped. */
function pointsToRating(points: number): number {
  return Math.min(10, Math.max(1, 6 + 0.35 * points));
}

/* ── Card classification ───────────────────────────────────────────────────── */

type CardKind = 'yellow' | 'blue' | 'red' | 'generic';

/**
 * Classifies a card action by its canonical type name first, then by its
 * localized label (covers custom actions). Red-ish checks run first so
 * SECOND_YELLOW_CARD is treated as a red card.
 */
function classifyCard(actionType: string, actionLabel: string): CardKind {
  const t = actionType.toUpperCase();
  const l = actionLabel.toLowerCase();
  if (
    t.includes('RED') ||
    t.includes('SECOND_YELLOW') ||
    t.includes('EXPEL') ||
    l.includes('roja')
  ) {
    return 'red';
  }
  if (t.includes('BLUE') || l.includes('azul')) return 'blue';
  if (t.includes('YELLOW') || l.includes('amarilla')) return 'yellow';
  return 'generic';
}

/** Heuristic card detection for action types without SportAction metadata. */
function looksLikeCard(actionType: string, actionLabel: string): boolean {
  const t = actionType.toUpperCase();
  const l = actionLabel.toLowerCase();
  return (
    t.includes('CARD') ||
    t.includes('YELLOW') ||
    t.includes('RED') ||
    t.includes('BLUE') ||
    l.includes('tarjeta') ||
    l.includes('amarilla') ||
    l.includes('roja') ||
    l.includes('azul')
  );
}

/* ── Core ──────────────────────────────────────────────────────────────────── */

interface Acc {
  entry: Omit<MvpEntry, 'points' | 'rating'>;
  points: number;
  firstGoalMinute: number | null;
  hasScoring: boolean;
}

/**
 * Computes the ranked player list for a match. Returns `null` when no player
 * has a scoring action (nothing decisive happened — no MVP is invented).
 */
export function computeMatchMVP(input: MvpInput): MvpResult | null {
  const cardMeta = new Set<string>();
  for (const sa of input.sportActions) {
    if (sa.isCard) cardMeta.add(sa.name.toUpperCase());
  }

  const accs = new Map<string, Acc>();

  const getAcc = (player: MvpActionPlayer): Acc => {
    let acc = accs.get(player.id);
    if (!acc) {
      acc = {
        entry: {
          playerId: player.id,
          playerName: player.name,
          playerNumber: player.number ?? null,
          playerNickname: player.nickname ?? null,
          playerPhoto: player.photo ?? null,
          playerPosition: player.position ?? null,
          playerBirthDate: player.birthDate ?? null,
          playerNationality: player.nationality ?? null,
          playerHeight: player.height ?? null,
          playerWeight: player.weight ?? null,
          teamId: player.teamId,
          breakdown: {
            goals: 0,
            ownGoals: 0,
            yellowCards: 0,
            blueCards: 0,
            redCards: 0,
          },
          firstGoalMinute: null,
        },
        points: 0,
        firstGoalMinute: null,
        hasScoring: false,
      };
      accs.set(player.id, acc);
    }
    return acc;
  };

  for (const action of input.actions) {
    if (!action.player) continue; // team-level actions can't produce an MVP

    const type = action.actionType.toUpperCase();
    const isCard =
      cardMeta.has(type) || looksLikeCard(action.actionType, action.actionLabel);

    const acc = getAcc(action.player);
    const value = action.value || 0;

    if (isCard) {
      const kind = classifyCard(action.actionType, action.actionLabel);
      switch (kind) {
        case 'red':
          acc.entry.breakdown.redCards++;
          acc.points += WEIGHTS.redCard;
          break;
        case 'blue':
          acc.entry.breakdown.blueCards++;
          acc.points += WEIGHTS.blueCard;
          break;
        case 'yellow':
          acc.entry.breakdown.yellowCards++;
          acc.points += WEIGHTS.yellowCard;
          break;
        default:
          acc.points += WEIGHTS.genericCard;
      }
      continue;
    }

    // Non-card action: mirrors the scoreboard rule (value > 0 scores).
    if (value > 0) {
      if (type === 'OWN_GOAL') {
        acc.entry.breakdown.ownGoals += value;
        acc.points += WEIGHTS.ownGoal * value;
      } else {
        acc.entry.breakdown.goals += value;
        acc.points += WEIGHTS.scoring * value;
        acc.hasScoring = true;
        if (action.minute != null) {
          acc.firstGoalMinute =
            acc.firstGoalMinute == null
              ? action.minute
              : Math.min(acc.firstGoalMinute, action.minute);
        }
      }
    }
  }

  const all = Array.from(accs.values());
  const scorers = all.filter((a) => a.hasScoring);
  if (scorers.length === 0) return null;

  // Winner / leader bonus for players who scored.
  let leaderTeamId: string | null = null;
  if (input.scoreA !== input.scoreB) {
    leaderTeamId = input.scoreA > input.scoreB ? input.teamAId : input.teamBId;
  }
  if (leaderTeamId) {
    for (const acc of all) {
      if (acc.entry.teamId === leaderTeamId && acc.hasScoring) {
        acc.points += WEIGHTS.winnerBonus;
      }
    }
  }

  // Rank: points → more goals → fewer total cards → earlier first goal → name.
  const totalCards = (b: MvpBreakdown) =>
    b.yellowCards + b.blueCards + b.redCards;
  const ranked = [...all].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.entry.breakdown.goals !== a.entry.breakdown.goals)
      return b.entry.breakdown.goals - a.entry.breakdown.goals;
    const cardsA = totalCards(a.entry.breakdown);
    const cardsB = totalCards(b.entry.breakdown);
    if (cardsA !== cardsB) return cardsA - cardsB;
    const mA = a.firstGoalMinute ?? Number.MAX_SAFE_INTEGER;
    const mB = b.firstGoalMinute ?? Number.MAX_SAFE_INTEGER;
    if (mA !== mB) return mA - mB;
    return a.entry.playerName.localeCompare(b.entry.playerName, 'es');
  });

  const entries: MvpEntry[] = ranked.map((acc) => ({
    ...acc.entry,
    firstGoalMinute: acc.firstGoalMinute,
    points: acc.points,
    rating: Math.round(pointsToRating(acc.points) * 10) / 10,
  }));

  const podium = entries.filter((e) => e.points > 0).slice(0, 3);

  return { mvp: entries[0], podium: podium.length > 0 ? podium : [entries[0]] };
}
