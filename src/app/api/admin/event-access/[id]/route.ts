import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/event-auth";

/**
 * DELETE /api/admin/event-access/[id]
 * Remove an event access assignment.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin(_request);
    if (error) return error;

    const { id } = await params;

    const existing = await db.eventAccess.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
    }

    await db.eventAccess.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}