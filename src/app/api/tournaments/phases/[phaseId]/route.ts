import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

/**
 * PUT /api/tournaments/phases/[phaseId]
 * Update a phase (name, type, order, isActive).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ phaseId: string }> }
) {
  try {
    const { error } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { phaseId } = await params;
    const body = await request.json();
    const { name, type, order, isActive } = body;

    const existing = await db.tournamentPhase.findUnique({ where: { id: phaseId } });
    if (!existing) {
      return NextResponse.json({ error: "Fase no encontrada" }, { status: 404 });
    }

    const phase = await db.tournamentPhase.update({
      where: { id: phaseId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(order !== undefined ? { order } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        _count: { select: { events: true } },
      },
    });

    return NextResponse.json({ success: true, phase });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/tournaments/phases/[phaseId]
 * Delete a phase (events keep tournamentPhaseId → null).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ phaseId: string }> }
) {
  try {
    const { error } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { phaseId } = await params;

    const existing = await db.tournamentPhase.findUnique({ where: { id: phaseId } });
    if (!existing) {
      return NextResponse.json({ error: "Fase no encontrada" }, { status: 404 });
    }

    await db.tournamentPhase.delete({ where: { id: phaseId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}