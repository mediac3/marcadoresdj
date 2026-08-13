import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamAccess } from "@/lib/event-auth";

/**
 * GET /api/teams
 *
 * Returns teams visible to the authenticated user.
 * - ADMIN: all teams.
 * - CREATOR / INITIATOR: requires teams.canView. Returns all teams (so they
 *   can be picked when creating events); the client hides edit/delete buttons
 *   for teams the user does not own via createdById.
 */
export async function GET(request: Request) {
  try {
    const { error, payload } = await requireTeamAccess(request, "view");
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sportId = searchParams.get("sportId");
    const gender = searchParams.get("gender");
    const ageCategory = searchParams.get("ageCategory");

    const where: Record<string, unknown> = {};
    if (sportId) where.sportId = sportId;
    if (gender) where.gender = gender;
    if (ageCategory) where.ageCategory = ageCategory;

    const teams = await db.team.findMany({
      where,
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        _count: {
          select: { players: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Expose createdById + the current userId so the client can gate
    // edit/delete buttons by ownership.
    return NextResponse.json({
      success: true,
      teams,
      currentUserId: payload.userId,
      currentUserRole: payload.role,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams
 *
 * Create a team. Requires teams.canCreate (ADMIN always allowed). The new
 * team is assigned to the authenticated user (createdById).
 */
export async function POST(request: Request) {
  try {
    const { error, payload } = await requireTeamAccess(request, "create");
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, shortName, logo, sportId, gender, ageCategory } = body;

    if (!name || !sportId) {
      return NextResponse.json(
        { error: "Name and sportId are required" },
        { status: 400 }
      );
    }

    const sport = await db.sport.findUnique({ where: { id: sportId } });
    if (!sport) {
      return NextResponse.json(
        { error: "Sport not found" },
        { status: 404 }
      );
    }

    const team = await db.team.create({
      data: {
        name,
        shortName: shortName || null,
        logo: logo || null,
        sportId,
        gender: gender || "Mixto",
        ageCategory: ageCategory || "Libre",
        createdById: payload.userId,
      },
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        _count: {
          select: { players: true },
        },
      },
    });

    return NextResponse.json({ success: true, team }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
