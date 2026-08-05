import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Scoring action types per sport (uppercase, matching SportAction.name in DB).
 * Used to identify which EventActions are goals/points.
 * OWN_GOAL / autogoles are excluded from the scorers list.
 */
const SPORT_SCORING_ACTIONS: Record<string, string[]> = {
  futbol: ["GOAL", "PENALTY_GOAL", "FREE_KICK_GOAL"],
  microfutbol: ["FUTSAL_GOAL", "FUTSAL_GOALKEEPER"],
  baloncesto: ["FREE_THROW", "TWO_POINTS", "THREE_POINTS"],
  handball: ["GOAL"],
  voleibol: ["PUNTO"],
  beisbol: ["CARRERA"],
};

/** Actions that should NOT count towards a player's scorer tally. */
const EXCLUDED_ACTIONS = new Set(["OWN_GOAL"]);

/**
 * Tab label per sport for the scorers section.
 */
const SPORT_TAB_LABELS: Record<string, string> = {
  futbol: "Goleadores",
  microfutbol: "Goleadores",
  handball: "Goleadores",
  baloncesto: "Anotadores",
  voleibol: "Anotadores",
  beisbol: "Carreras",
};

interface ScorerRow {
  playerId: string;
  playerName: string;
  playerNumber: number | null;
  playerPhoto: string | null;
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  teamLogo: string | null;
  total: number;
  matchesPlayed: number;
  breakdown: Record<string, number>; // actionType -> count
}

/**
 * GET /api/public/tournaments/[id]/scorers
 * Public endpoint – no auth required.
 * Returns top scorers across all phases of a tournament.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        sport: { select: { id: true, name: true } },
        phases: {
          where: { isActive: true },
          select: {
            id: true,
            events: {
              where: {
                isPublic: true,
                status: { in: ["FINISHED", "LIVE", "PAUSED"] },
              },
              select: {
                id: true,
                teamAId: true,
                teamBId: true,
                actions: {
                  select: {
                    actionType: true,
                    actionLabel: true,
                    value: true,
                    playerId: true,
                  },
                },
              },
              orderBy: { scheduledAt: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    const sportKey = tournament.sport?.name?.toLowerCase() ?? "";
    const scoringActions = SPORT_SCORING_ACTIONS[sportKey];
    // Fallback: if no known list for this sport, include all value > 0 actions
    const isKnownSport = !!scoringActions;

    // Accumulate per-player stats
    const playerMap = new Map<
      string,
      {
        playerId: string;
        playerName: string;
        playerNumber: number | null;
        playerPhoto: string | null;
        teamId: string;
        teamName: string;
        teamShortName: string | null;
        teamLogo: string | null;
        total: number;
        eventIds: Set<string>;
        breakdown: Record<string, number>;
      }
    >();

    // We need player + team data, so we query actions with player include
    const allEvents = tournament.phases.flatMap((p) => p.events);

    // Collect unique player IDs from actions to batch-fetch player data
    const relevantPlayerIds = new Set<string>();
    for (const event of allEvents) {
      for (const action of event.actions) {
        if (!action.playerId) continue;
        if (EXCLUDED_ACTIONS.has(action.actionType)) continue;
        if (isKnownSport && !scoringActions.includes(action.actionType)) continue;
        if (action.value <= 0) continue;
        relevantPlayerIds.add(action.playerId);
      }
    }

    // Batch fetch players with team
    const players = await db.player.findMany({
      where: { id: { in: Array.from(relevantPlayerIds) } },
      select: {
        id: true,
        name: true,
        number: true,
        photo: true,
        teamId: true,
        team: { select: { id: true, name: true, shortName: true, logo: true } },
      },
    });

    const playerDataMap = new Map(players.map((p) => [p.id, p]));

    // Process actions
    for (const event of allEvents) {
      for (const action of event.actions) {
        if (!action.playerId) continue;
        if (EXCLUDED_ACTIONS.has(action.actionType)) continue;
        if (isKnownSport && !scoringActions.includes(action.actionType)) continue;
        if (action.value <= 0) continue;

        const player = playerDataMap.get(action.playerId);
        if (!player) continue;

        const existing = playerMap.get(action.playerId);
        if (existing) {
          existing.total += action.value;
          existing.eventIds.add(event.id);
          existing.breakdown[action.actionType] =
            (existing.breakdown[action.actionType] ?? 0) + action.value;
        } else {
          playerMap.set(action.playerId, {
            playerId: player.id,
            playerName: player.name,
            playerNumber: player.number,
            playerPhoto: player.photo,
            teamId: player.team.id,
            teamName: player.team.name,
            teamShortName: player.team.shortName,
            teamLogo: player.team.logo,
            total: action.value,
            eventIds: new Set([event.id]),
            breakdown: { [action.actionType]: action.value },
          });
        }
      }
    }

    // Sort by total desc, then name asc
    const scorers: ScorerRow[] = Array.from(playerMap.values())
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.playerName.localeCompare(b.playerName);
      })
      .map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        playerNumber: p.playerNumber,
        playerPhoto: p.playerPhoto,
        teamId: p.teamId,
        teamName: p.teamName,
        teamShortName: p.teamShortName,
        teamLogo: p.teamLogo,
        total: p.total,
        matchesPlayed: p.eventIds.size,
        breakdown: p.breakdown,
      }));

    const tabLabel = SPORT_TAB_LABELS[sportKey] ?? "Anotadores";

    return NextResponse.json({
      success: true,
      scorers,
      tabLabel,
      sport: tournament.sport?.name ?? "",
    });
  } catch (err) {
    console.error("[PUBLIC SCORERS ERROR]", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
