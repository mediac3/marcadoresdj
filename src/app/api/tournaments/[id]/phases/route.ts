import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

const VALID_PHASE_TYPES = [
  "ELIMINATORIA",
  "GRUPOS",
  "OCTAVOS",
  "CUARTOS",
  "SEMIFINAL",
  "FINAL",
  "TERCER_PUESTO",
] as const;

const PHASE_TYPE_LABELS: Record<string, string> = {
  ELIMINATORIA: "Eliminatoria",
  GRUPOS: "Fase de Grupos",
  OCTAVOS: "Octavos de Final",
  CUARTOS: "Cuartos de Final",
  SEMIFINAL: "Semifinal",
  FINAL: "Final",
  TERCER_PUESTO: "Tercer Puesto",
};

/**
 * GET /api/tournaments/[id]/phases
 * List all phases for a tournament with event count.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { id } = await params;

    const tournament = await db.tournament.findUnique({ where: { id } });
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    const phases = await db.tournamentPhase.findMany({
      where: { tournamentId: id },
      include: {
        _count: { select: { events: true } },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ success: true, phases });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/tournaments/[id]/phases
 * Create a new phase in the tournament.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { name, type, order, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nombre de fase requerido" }, { status: 400 });
    }

    if (type && !VALID_PHASE_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Tipo inválido. Opciones: ${VALID_PHASE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const tournament = await db.tournament.findUnique({ where: { id } });
    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // Auto-assign order if not provided
    const maxOrder = await db.tournamentPhase.findFirst({
      where: { tournamentId: id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const autoOrder = (maxOrder?.order ?? -1) + 1;

    const phase = await db.tournamentPhase.create({
      data: {
        tournamentId: id,
        name: name.trim(),
        type: type || "GRUPOS",
        order: order ?? autoOrder,
        isActive: isActive ?? true,
      },
      include: {
        _count: { select: { events: true } },
      },
    });

    return NextResponse.json({ success: true, phase }, { status: 201 });
  } catch (e: unknown) {
    // Handle unique constraint violation
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique")) {
      return NextResponse.json(
        { error: "Ya existe una fase con ese nombre en este torneo" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export { VALID_PHASE_TYPES, PHASE_TYPE_LABELS };