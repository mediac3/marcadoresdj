import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/sports
 *
 * Public endpoint – no auth required.
 *
 * Returns active sports (id, name, icon) so the public event-creation wizard
 * can render the sport picker for unauthenticated visitors.
 *
 * The authenticated GET /api/sports requires a token, which a visitor creating
 * their first event does not have yet.
 */
export async function GET() {
  try {
    const sports = await db.sport.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        icon: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, sports });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
