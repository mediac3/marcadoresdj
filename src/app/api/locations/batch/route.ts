import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

interface LocationRow {
  pais: string;
  departamento: string;
  ciudad: string;
  codigoPais?: string;
}

/**
 * POST /api/locations/batch
 *
 * Import locations from an array of { pais, departamento, ciudad, codigoPais? }.
 * Uses upsert so repeated imports are idempotent.
 * Returns counts of created items.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const rows: LocationRow[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "rows array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (rows.length > 2000) {
      return NextResponse.json(
        { error: "Maximum 2000 rows per import" },
        { status: 400 }
      );
    }

    let countriesCreated = 0;
    let departmentsCreated = 0;
    let citiesCreated = 0;
    let errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.pais?.trim() || !row.departamento?.trim() || !row.ciudad?.trim()) {
        errors.push({ row: rowNum, error: "País, Departamento y Ciudad son obligatorios" });
        continue;
      }

      try {
        // Upsert country
        const country = await db.country.upsert({
          where: { name: row.pais.trim() },
          create: {
            name: row.pais.trim(),
            code: row.codigoPais?.trim() || null,
          },
          update: {
            code: row.codigoPais?.trim() || undefined,
          },
        });
        if (country.createdAt.getTime() === country.updatedAt.getTime()) {
          countriesCreated++;
        }

        // Upsert department
        const dept = await db.department.upsert({
          where: {
            name_countryId: {
              name: row.departamento.trim(),
              countryId: country.id,
            },
          },
          create: {
            name: row.departamento.trim(),
            countryId: country.id,
          },
          update: {},
        });
        if (dept.createdAt.getTime() === dept.updatedAt.getTime()) {
          departmentsCreated++;
        }

        // Upsert city
        const city = await db.city.upsert({
          where: {
            name_departmentId: {
              name: row.ciudad.trim(),
              departmentId: dept.id,
            },
          },
          create: {
            name: row.ciudad.trim(),
            departmentId: dept.id,
          },
          update: {},
        });
        if (city.createdAt.getTime() === city.updatedAt.getTime()) {
          citiesCreated++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        errors.push({ row: rowNum, error: msg });
      }
    }

    return NextResponse.json({
      success: true,
      created: {
        countries: countriesCreated,
        departments: departmentsCreated,
        cities: citiesCreated,
      },
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}