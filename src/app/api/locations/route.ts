import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/event-auth";

/**
 * GET /api/locations?type=countries|departments|cities&countryId=...&departmentId=...
 *
 * Returns location data for cascading selectors.
 * No auth required for GET — public visitors need to filter events.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") || "countries";
    const countryId = searchParams.get("countryId");
    const departmentId = searchParams.get("departmentId");

    if (type === "countries") {
      const countries = await db.country.findMany({
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ success: true, countries });
    }

    if (type === "departments") {
      if (!countryId) {
        return NextResponse.json(
          { error: "countryId is required" },
          { status: 400 }
        );
      }
      const departments = await db.department.findMany({
        where: { countryId },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ success: true, departments });
    }

    if (type === "cities") {
      if (!departmentId) {
        return NextResponse.json(
          { error: "departmentId is required" },
          { status: 400 }
        );
      }
      const cities = await db.city.findMany({
        where: { departmentId },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ success: true, cities });
    }

    return NextResponse.json(
      { error: "Invalid type. Use countries, departments, or cities." },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locations
 *
 * Create a single country, department, or city.
 * Admin only.
 * Body: { type: "country"|"department"|"city", name: string, code?: string, countryId?: string, departmentId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const body = await request.json();
    const { type, name, code, countryId, departmentId } = body as {
      type?: string;
      name?: string;
      code?: string;
      countryId?: string;
      departmentId?: string;
    };

    if (!type || !name || !name.trim()) {
      return NextResponse.json(
        { error: "type y name son obligatorios" },
        { status: 400 }
      );
    }

    if (type === "country") {
      if (!code || !code.trim()) {
        return NextResponse.json(
          { error: "El código del país es obligatorio (ej: CO)" },
          { status: 400 }
        );
      }
      const existing = await db.country.findFirst({
        where: { OR: [{ name: name.trim() }, { code: code.trim().toUpperCase() }] },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Ya existe un país con ese nombre o código" },
          { status: 409 }
        );
      }
      const country = await db.country.create({
        data: { name: name.trim(), code: code.trim().toUpperCase() },
      });
      return NextResponse.json({ success: true, country });
    }

    if (type === "department") {
      if (!countryId) {
        return NextResponse.json(
          { error: "countryId es obligatorio" },
          { status: 400 }
        );
      }
      const existing = await db.department.findFirst({
        where: { name: name.trim(), countryId },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Ya existe un departamento con ese nombre en este país" },
          { status: 409 }
        );
      }
      const department = await db.department.create({
        data: { name: name.trim(), countryId },
      });
      return NextResponse.json({ success: true, department });
    }

    if (type === "city") {
      if (!departmentId) {
        return NextResponse.json(
          { error: "departmentId es obligatorio" },
          { status: 400 }
        );
      }
      const existing = await db.city.findFirst({
        where: { name: name.trim(), departmentId },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Ya existe una ciudad con ese nombre en este departamento" },
          { status: 409 }
        );
      }
      const city = await db.city.create({
        data: { name: name.trim(), departmentId },
      });
      return NextResponse.json({ success: true, city });
    }

    return NextResponse.json(
      { error: "Tipo inválido. Use country, department o city." },
      { status: 400 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/locations?type=country|department|city&id=...
 *
 * Delete a location and its children (cascade).
 * Admin only.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json(
        { error: "type and id are required" },
        { status: 400 }
      );
    }

    if (type === "country") {
      // Check if any events reference this country
      const eventCount = await db.event.count({ where: { countryId: id } });
      if (eventCount > 0) {
        return NextResponse.json(
          { error: `No se puede eliminar: ${eventCount} evento(s) usan este país` },
          { status: 409 }
        );
      }
      await db.country.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (type === "department") {
      const eventCount = await db.event.count({ where: { departmentId: id } });
      if (eventCount > 0) {
        return NextResponse.json(
          { error: `No se puede eliminar: ${eventCount} evento(s) usan este departamento` },
          { status: 409 }
        );
      }
      await db.department.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (type === "city") {
      const eventCount = await db.event.count({ where: { cityId: id } });
      if (eventCount > 0) {
        return NextResponse.json(
          { error: `No se puede eliminar: ${eventCount} evento(s) usan esta ciudad` },
          { status: 409 }
        );
      }
      await db.city.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid type. Use country, department, or city." },
      { status: 400 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}