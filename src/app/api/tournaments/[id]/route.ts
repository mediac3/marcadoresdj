import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin, requireEventCreatorOrAdmin } from "@/lib/event-auth";

/**
 * GET /api/tournaments/[id]
 * Get a single tournament with its phases (sorted by order).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireCreatorOrAdmin(_request);
    if (error) return error;

    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        sport: { select: { id: true, name: true, icon: true } },
        createdBy: { select: { id: true, username: true, name: true } },
        phases: {
          orderBy: { order: "asc" },
          include: {
            _count: { select: { events: true } },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, tournament });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PUT /api/tournaments/[id]
 * Update a tournament.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { name, sportId, startDate, endDate, location, logo, description, isActive } = body;

    const existing = await db.tournament.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    const tournament = await db.tournament.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(sportId !== undefined ? { sportId } : {}),
        ...(startDate !== undefined ? { startDate: startDate || null } : {}),
        ...(endDate !== undefined ? { endDate: endDate || null } : {}),
        ...(location !== undefined ? { location: location || null } : {}),
        ...(logo !== undefined ? { logo: logo || null } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        sport: { select: { id: true, name: true, icon: true } },
        createdBy: { select: { id: true, username: true, name: true } },
        _count: { select: { phases: true } },
      },
    });

    return NextResponse.json({ success: true, tournament });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/tournaments/[id]
 * Delete a tournament (cascades to phases, events keep tournamentPhaseId → null).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { id } = await params;

    const existing = await db.tournament.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    await db.tournament.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}