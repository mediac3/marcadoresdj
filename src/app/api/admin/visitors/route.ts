import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/event-auth";
import { formatPhoneDisplay } from "@/lib/phone";

/**
 * GET /api/admin/visitors
 *
 * Admin-only. Returns guest CREATOR accounts that have a WhatsApp phone,
 * with the number of events they created and their remaining credits.
 *
 * Used by the Terms panel "Visitantes" table so the admin can see, per phone:
 *   - phone (formatted for display)
 *   - raw phone (E.164)
 *   - events created
 *   - credits left
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const visitors = await db.user.findMany({
    where: {
      phone: { not: null },
    },
    select: {
      id: true,
      username: true,
      phone: true,
      credits: true,
      createdAt: true,
      _count: { select: { eventsCreated: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = visitors.map((v) => ({
    id: v.id,
    username: v.username,
    phone: v.phone,
    phoneDisplay: formatPhoneDisplay(v.phone ?? ""),
    credits: v.credits,
    eventsCreated: v._count.eventsCreated,
    createdAt: v.createdAt,
  }));

  return NextResponse.json({ success: true, visitors: rows });
}
