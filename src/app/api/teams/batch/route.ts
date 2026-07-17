import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCreatorOrAdmin } from '@/lib/event-auth';

export async function POST(request: Request) {
  try {
    /* ── Auth ────────────────────────────────────────────────────────────── */
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;

    /* ── Parse body ──────────────────────────────────────────────────────── */
    const body = await request.json();
    const { teams } = body;

    if (!Array.isArray(teams) || teams.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un arreglo de equipos y no debe estar vacio' },
        { status: 400 },
      );
    }

    if (teams.length > 500) {
      return NextResponse.json(
        { error: 'Maximo 500 equipos por importacion' },
        { status: 400 },
      );
    }

    /* ── Validate rows & build create payloads ────────────────────────────── */
    const errors: { row: number; message: string }[] = [];
    const payloads: {
      name: string;
      shortName: string | null;
      logo: string | null;
      sportId: string;
      gender: string;
      ageCategory: string;
    }[] = [];

    // Pre-fetch all sports for ID resolution by name
    const allSports = await db.sport.findMany({ select: { id: true, name: true } });
    const sportNameMap = new Map(allSports.map((s) => [s.name.toLowerCase(), s.id]));

    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];
      const row = i + 2; // Excel row number (1 = header)

      // Name (required)
      if (!t.name || typeof t.name !== 'string' || !t.name.trim()) {
        errors.push({ row, message: 'Nombre es requerido' });
        continue;
      }

      // Sport: accept either a sportId or a sport name
      let sportId = '';
      if (t.sportId && typeof t.sportId === 'string' && t.sportId.trim()) {
        sportId = t.sportId.trim();
      } else if (t.sport && typeof t.sport === 'string' && t.sport.trim()) {
        sportId = sportNameMap.get(t.sport.trim().toLowerCase()) || '';
        if (!sportId) {
          errors.push({ row, message: `Deporte "${t.sport.trim()}" no encontrado` });
          continue;
        }
      } else {
        errors.push({ row, message: 'Deporte es requerido (nombre o ID)' });
        continue;
      }

      // Verify sport exists (if sportId was provided directly)
      if (sportId && !allSports.some((s) => s.id === sportId)) {
        errors.push({ row, message: `Deporte con ID "${sportId}" no encontrado` });
        continue;
      }

      // Optional fields
      const shortName =
        typeof t.shortName === 'string' && t.shortName.trim()
          ? t.shortName.trim().slice(0, 5)
          : null;

      const logo =
        typeof t.logo === 'string' && t.logo.trim() ? t.logo.trim() : null;

      // Gender — validate against allowed values
      const validGenders = ['Masculino', 'Femenino', 'Mixto'];
      let gender = 'Mixto';
      if (t.gender && typeof t.gender === 'string' && t.gender.trim()) {
        const g = t.gender.trim();
        if (!validGenders.includes(g)) {
          errors.push({
            row,
            message: `Genero "${g}" no es valido (valores: ${validGenders.join(', ')})`,
          });
          continue;
        }
        gender = g;
      }

      // Age category — validate against allowed values
      const validCategories = [
        'Sub-13', 'Sub-15', 'Sub-17', 'Juvenil', 'Junior',
        'Sub-20', 'Sub-23', 'Senior', 'Libre',
      ];
      let ageCategory = 'Libre';
      if (t.ageCategory && typeof t.ageCategory === 'string' && t.ageCategory.trim()) {
        const c = t.ageCategory.trim();
        if (!validCategories.includes(c)) {
          errors.push({
            row,
            message: `Categoria "${c}" no es valida`,
          });
          continue;
        }
        ageCategory = c;
      }

      payloads.push({
        name: t.name.trim(),
        shortName,
        logo,
        sportId,
        gender,
        ageCategory,
      });
    }

    if (payloads.length === 0) {
      return NextResponse.json(
        {
          success: false,
          created: 0,
          errors: errors.length > 0 ? errors : [{ row: 0, message: 'No se encontraron equipos validos para importar' }],
        },
        { status: 400 },
      );
    }

    /* ── Create teams in a transaction ────────────────────────────────────── */
    const created = await db.$transaction(
      payloads.map((p) =>
        db.team.create({
          data: p,
          include: { sport: { select: { id: true, name: true, icon: true } }, _count: { select: { players: true } } },
        }),
      ),
    );

    return NextResponse.json(
      {
        success: true,
        created: created.length,
        total: teams.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}