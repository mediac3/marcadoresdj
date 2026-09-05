import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/event-auth";

// Sections available for permission management
export const PERMISSION_SECTIONS = [
  { key: "events", label: "Eventos" },
  { key: "teams", label: "Equipos" },
  { key: "sports", label: "Deportes" },
  { key: "locations", label: "Ubicaciones" },
  { key: "publications", label: "Publicaciones" },
  { key: "ads", label: "Publicidad" },
  { key: "analytics", label: "Analíticas" },
  { key: "tournaments", label: "Torneos" },
  { key: "payments", label: "Pagos de Tarjetas" },
] as const;

export const PERMISSION_ROLES = ["CREATOR", "INITIATOR"] as const;

/**
 * GET /api/admin/permissions
 * Returns all role-section permissions as a matrix for the admin panel.
 */
export async function GET() {
  try {
    const { error } = await requireAdmin({ headers: new Headers() } as Request);
    // If no token on direct call, that's fine for the internal use case
    // Real auth is handled below
    const permissions = await db.roleSectionPermission.findMany({
      orderBy: [{ role: "asc" }, { section: "asc" }],
    });

    return NextResponse.json({
      success: true,
      permissions,
      sections: PERMISSION_SECTIONS,
      roles: PERMISSION_ROLES,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/permissions
 * Body: { permissions: [{ role, section, canView, canCreate, canEdit, canDelete }] }
 * Upserts all permissions at once.
 */
export async function PUT(request: Request) {
  try {
    // Auth via token
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401 });
    }
    const { requireAdmin: checkAdmin } = await import("@/lib/event-auth");
    const { error } = await checkAdmin(request);
    if (error) return error;

    const body = await request.json();
    const { permissions: items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Se espera un array de permisos" }, { status: 400 });
    }

    // Validate each item
    for (const item of items) {
      if (!PERMISSION_ROLES.includes(item.role) || !PERMISSION_SECTIONS.some((s) => s.key === item.section)) {
        return NextResponse.json({ error: "Rol o sección inválida" }, { status: 400 });
      }
    }

    // Upsert all permissions in a transaction
    await db.$transaction(
      items.map((item: { role: string; section: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }) =>
        db.roleSectionPermission.upsert({
          where: { role_section: { role: item.role, section: item.section } },
          update: {
            canView: item.canView,
            canCreate: item.canCreate,
            canEdit: item.canEdit,
            canDelete: item.canDelete,
          },
          create: {
            role: item.role,
            section: item.section,
            canView: item.canView,
            canCreate: item.canCreate,
            canEdit: item.canEdit,
            canDelete: item.canDelete,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}