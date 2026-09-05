import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSectionAccess } from "@/lib/event-auth";

/**
 * GET /api/player-actions
 *
 * Table of player actions across all events, with server-side filters:
 *   sportId, eventId, teamId, playerId, actionType,
 *   paymentStatus (CARDS_ONLY | PENDING | PAID), dateFrom, dateTo (ISO),
 *   search (player name, case-insensitive, applied in JS)
 *
 * Also returns filter options (sports with card config, events, teams,
 * distinct action types) so the view doesn't need other permission-scoped
 * endpoints.
 */
export async function GET(request: Request) {
  try {
    const { error } = await requireSectionAccess(request, "payments", "view");
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const sportId = searchParams.get("sportId") || undefined;
    const eventId = searchParams.get("eventId") || undefined;
    const teamId = searchParams.get("teamId") || undefined;
    const playerId = searchParams.get("playerId") || undefined;
    const actionType = searchParams.get("actionType") || undefined;
    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const where: Prisma.EventActionWhereInput = {
      playerId: { not: null }, // only player actions — payments are per player
    };

    if (eventId) where.eventId = eventId;
    if (playerId) where.playerId = playerId;
    if (actionType) where.actionType = actionType;
    if (sportId) where.event = { sportId };
    if (teamId) where.player = { teamId };
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }
    if (paymentStatus === "CARDS_ONLY") {
      where.cardPayment = { isNot: null };
    } else if (paymentStatus === "PENDING" || paymentStatus === "PAID") {
      where.cardPayment = { status: paymentStatus };
    }

    let actions = await db.eventAction.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            name: true,
            number: true,
            nickname: true,
            teamId: true,
            team: { select: { id: true, name: true } },
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            sportId: true,
            status: true,
            scheduledAt: true,
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
          },
        },
        cardPayment: {
          include: {
            paidBy: { select: { username: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Case-insensitive player-name search (SQLite `contains` is case-sensitive)
    if (search) {
      actions = actions.filter((a) =>
        (a.player?.name || "").toLowerCase().includes(search) ||
        String(a.player?.number ?? "").includes(search)
      );
    }

    // ── Filter options (scoped data, no extra permissions needed) ──
    const sports = await db.sport.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        icon: true,
        actions: {
          select: {
            id: true,
            name: true,
            label: true,
            icon: true,
            color: true,
            isCard: true,
            cardAmount: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const events = await db.event.findMany({
      select: {
        id: true,
        name: true,
        sportId: true,
        status: true,
        scheduledAt: true,
        teamA: { select: { name: true } },
        teamB: { select: { name: true } },
      },
      orderBy: { scheduledAt: "desc" },
    });

    const teams = await db.team.findMany({
      select: { id: true, name: true, sportId: true },
      orderBy: { name: "asc" },
    });

    // Distinct action types present in recorded actions
    const actionTypesMap = new Map<string, { actionType: string; actionLabel: string; actionIcon: string }>();
    for (const a of actions) {
      if (!actionTypesMap.has(a.actionType)) {
        actionTypesMap.set(a.actionType, {
          actionType: a.actionType,
          actionLabel: a.actionLabel,
          actionIcon: a.actionIcon,
        });
      }
    }

    return NextResponse.json({
      success: true,
      actions,
      filterOptions: {
        sports,
        events,
        teams,
        actionTypes: Array.from(actionTypesMap.values()).sort((a, b) =>
          a.actionLabel.localeCompare(b.actionLabel)
        ),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
