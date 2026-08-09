import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/event-auth";

/**
 * GET /api/admin/terms/acceptances
 *
 * Admin-only. Returns the audit trail of Terms & Conditions acceptances
 * recorded when visitors create public events via the wizard.
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const rows = await db.eventTermsAcceptance.findMany({
    orderBy: { acceptedAt: "desc" },
    take: 200,
    include: {
      event: {
        select: {
          id: true,
          name: true,
          sport: { select: { name: true, icon: true } },
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        },
      },
      guestUser: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json({ success: true, acceptances: rows });
}
