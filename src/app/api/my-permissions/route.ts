import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/event-auth";

/**
 * GET /api/my-permissions
 * Returns the current user's effective permissions (sections they can access).
 * ADMIN always gets all sections with full access.
 * Other roles get their RoleSectionPermission records.
 */
export async function GET(request: Request) {
  try {
    const { error, payload } = await requireAuth(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ADMIN has full access to everything
    if (payload.role === "ADMIN") {
      const allSections = [
        "events", "teams", "sports", "locations",
        "publications", "ads", "analytics", "tournaments", "payments",
      ];
      return NextResponse.json({
        success: true,
        role: payload.role,
        permissions: allSections.map((section) => ({
          role: "ADMIN",
          section,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        })),
      });
    }

    // For CREATOR and INITIATOR, fetch their role's permissions
    const permissions = await db.roleSectionPermission.findMany({
      where: { role: payload.role },
    });

    return NextResponse.json({
      success: true,
      role: payload.role,
      permissions,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}