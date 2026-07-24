import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/sports
 *
 * Public endpoint – no auth required.
 * Returns active sports with their actions (including mvpWeight) so the public
 * view can compute the MVP (Jugador del Partido) client-side.
 */
export async function GET() {
  try {
    const sports = await db.sport.findMany({
      where: { isActive: true },
      select: {
        id: true,
        actions: {
          select: {
            name: true,
            mvpWeight: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, sports });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
