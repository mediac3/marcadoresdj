import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamAccess } from "@/lib/event-auth";

/**
 * GET /api/teams/[id]
 *
 * View a team detail. Requires teams.canView (ADMIN always allowed).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, payload } = await requireTeamAccess(request, "view");
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const team = await db.team.findUnique({
      where: { id },
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        players: {
          orderBy: [{ number: "asc" }, { name: "asc" }],
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      team,
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
 * PUT /api/teams/[id]
 *
 * Edit a team. Requires teams.canEdit AND ownership (createdById) for
 * non-admin users.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.team.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    const { error } = await requireTeamAccess(request, "edit", existing);
    if (error) return error;

    const body = await request.json();
    const { name, shortName, logo, sportId, gender, ageCategory } = body;

    if (sportId) {
      const sport = await db.sport.findUnique({ where: { id: sportId } });
      if (!sport) {
        return NextResponse.json(
          { error: "Sport not found" },
          { status: 404 }
        );
      }
    }

    const team = await db.team.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(shortName !== undefined && { shortName: shortName || null }),
        ...(logo !== undefined && { logo: logo || null }),
        ...(sportId && { sportId }),
        ...(gender !== undefined && { gender }),
        ...(ageCategory !== undefined && { ageCategory }),
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

    return NextResponse.json({ success: true, team });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id]
 *
 * Delete a team. Requires teams.canDelete AND ownership (createdById) for
 * non-admin users.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.team.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    const { error } = await requireTeamAccess(request, "delete", existing);
    if (error) return error;

    await db.team.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Team deleted" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
