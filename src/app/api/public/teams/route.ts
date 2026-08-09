import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/teams?sportId=...
 *
 * Public endpoint – no auth required.
 *
 * Returns public teams filtered by sportId so the public event-creation
 * wizard can let unauthenticated visitors pick an existing team.
 *
 * Only returns the minimal public fields needed by the picker (id, name,
 * shortName, logo, sportId). The authenticated GET /api/teams requires a
 * token, which a visitor creating their first event does not have yet.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sportId = searchParams.get("sportId");

    const where: Record<string, unknown> = {};
    if (sportId) where.sportId = sportId;

    const teams = await db.team.findMany({
      where,
      select: {
        id: true,
        name: true,
        shortName: true,
        logo: true,
        sportId: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, teams });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
