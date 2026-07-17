import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin, requireAuth } from "@/lib/event-auth";

/* ── Default phases by sport name (auto-generated on tournament creation) ── */

const DEFAULT_PHASES: Record<string, Array<{ name: string; type: string }>> = {
  'Fútbol': [
    { name: 'Fase de Grupos', type: 'GRUPOS' },
    { name: 'Cuartos de Final', type: 'CUARTOS' },
    { name: 'Semifinal', type: 'SEMIFINAL' },
    { name: 'Final', type: 'FINAL' },
    { name: 'Tercer Puesto', type: 'TERCER_PUESTO' },
  ],
  'Microfútbol': [
    { name: 'Fase de Grupos', type: 'GRUPOS' },
    { name: 'Semifinal', type: 'SEMIFINAL' },
    { name: 'Final', type: 'FINAL' },
    { name: 'Tercer Puesto', type: 'TERCER_PUESTO' },
  ],
  'Baloncesto': [
    { name: 'Fase de Grupos', type: 'GRUPOS' },
    { name: 'Cuartos de Final', type: 'CUARTOS' },
    { name: 'Semifinal', type: 'SEMIFINAL' },
    { name: 'Final', type: 'FINAL' },
    { name: 'Tercer Puesto', type: 'TERCER_PUESTO' },
  ],
};

// Fallback for sports not in the map
const GENERIC_PHASES = [
  { name: 'Eliminatoria', type: 'ELIMINATORIA' },
  { name: 'Cuartos de Final', type: 'CUARTOS' },
  { name: 'Semifinal', type: 'SEMIFINAL' },
  { name: 'Final', type: 'FINAL' },
  { name: 'Tercer Puesto', type: 'TERCER_PUESTO' },
];

/**
 * GET /api/tournaments?sportId=xxx&minimal=true
 * List tournaments. With ?minimal=true, returns only id+name+phases (for event wizard selectors).
 * Requires creator-or-admin auth (or auth for minimal).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sportId = searchParams.get("sportId");
    const includeInactive = searchParams.get("all") === "true";
    const minimal = searchParams.get("minimal") === "true";

    // For the event wizard selector, require any auth
    if (minimal) {
      const { error } = await requireAuth(request);
      if (error) return error;
    } else {
      const { error } = await requireCreatorOrAdmin(request);
      if (error) return error;
    }

    const where: Record<string, unknown> = {};
    if (sportId) where.sportId = sportId;
    if (!includeInactive) where.isActive = true;

    if (minimal) {
      // Lightweight: only id, name, and phases (id+name+type+order)
      const tournaments = await db.tournament.findMany({
        where,
        select: {
          id: true,
          name: true,
          logo: true,
          phases: {
            where: { isActive: true },
            select: { id: true, name: true, type: true, order: true },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ success: true, tournaments });
    }

    const tournaments = await db.tournament.findMany({
      where,
      include: {
        sport: { select: { id: true, name: true, icon: true } },
        createdBy: { select: { id: true, username: true, name: true } },
        _count: { select: { phases: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, tournaments });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/tournaments
 * Create a new tournament with auto-generated phases based on sport.
 * Body: { name, sportId, startDate?, endDate?, location?, logo?, description?, autoPhases?: boolean }
 */
export async function POST(request: Request) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const body = await request.json();
    const { name, sportId, startDate, endDate, location, logo, description, autoPhases } = body;

    if (!name?.trim() || !sportId) {
      return NextResponse.json({ error: "Nombre y deporte son requeridos" }, { status: 400 });
    }

    // Verify sport exists
    const sport = await db.sport.findUnique({ where: { id: sportId } });
    if (!sport) {
      return NextResponse.json({ error: "Deporte no encontrado" }, { status: 404 });
    }

    // Determine phases to auto-generate
    const shouldAutoGenerate = autoPhases !== false; // default true
    const phaseTemplates = DEFAULT_PHASES[sport.name] || GENERIC_PHASES;

    const tournament = await db.tournament.create({
      data: {
        name: name.trim(),
        sportId,
        startDate: startDate || null,
        endDate: endDate || null,
        location: location || null,
        logo: logo || null,
        description: description || null,
        createdById: payload!.userId,
        ...(shouldAutoGenerate
          ? {
              phases: {
                create: phaseTemplates.map((p, i) => ({
                  name: p.name,
                  type: p.type,
                  order: i,
                })),
              },
            }
          : {}),
      },
      include: {
        sport: { select: { id: true, name: true, icon: true } },
        createdBy: { select: { id: true, username: true, name: true } },
        phases: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json({ success: true, tournament }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}