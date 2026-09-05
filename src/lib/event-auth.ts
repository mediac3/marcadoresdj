import { NextResponse } from "next/server";
import { verifyToken, extractBearerToken, type JwtPayload } from "@/lib/auth";
import { db } from "@/lib/db";

interface AuthResult {
  error: NextResponse | null;
  payload: JwtPayload | null;
}

/**
 * Require any authenticated user.
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: "Authorization token is required" }, { status: 401 }),
      payload: null,
    };
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return {
      error: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }),
      payload: null,
    };
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return {
      error: NextResponse.json({ error: "User not found or deactivated" }, { status: 401 }),
      payload: null,
    };
  }

  return { error: null, payload };
}

/**
 * Require INITIATOR, CREATOR, or ADMIN role.
 */
export async function requireInitiatorOrAbove(request: Request): Promise<AuthResult> {
  const result = await requireAuth(request);
  if (result.error) return result;
  if (!result.payload) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      payload: null,
    };
  }

  const allowedRoles = ["ADMIN", "CREATOR", "INITIATOR"];
  if (!allowedRoles.includes(result.payload.role)) {
    return {
      error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
      payload: null,
    };
  }

  return result;
}

/**
 * Require CREATOR or ADMIN role.
 */
export async function requireCreatorOrAdmin(request: Request): Promise<AuthResult> {
  const result = await requireAuth(request);
  if (result.error) return result;
  if (!result.payload) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      payload: null,
    };
  }

  const allowedRoles = ["ADMIN", "CREATOR"];
  if (!allowedRoles.includes(result.payload.role)) {
    return {
      error: NextResponse.json({ error: "Creator or Admin access required" }, { status: 403 }),
      payload: null,
    };
  }

  return result;
}

/**
 * Require ADMIN role.
 */
export async function requireAdmin(request: Request): Promise<AuthResult> {
  const result = await requireAuth(request);
  if (result.error) return result;
  if (!result.payload) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      payload: null,
    };
  }

  if (result.payload.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
      payload: null,
    };
  }

  return result;
}

/**
 * Require scoring access: ADMIN and CREATOR can score any event they have access to.
 * INITIATOR must have explicit EventAccess for the specific event.
 */
export async function requireScoringAccess(
  request: Request,
  eventId: string
): Promise<AuthResult> {
  const result = await requireAuth(request);
  if (result.error) return result;
  if (!result.payload) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), payload: null };
  }

  // ADMIN and CREATOR can score any event they have access to
  if (result.payload.role === "ADMIN" || result.payload.role === "CREATOR") {
    return result;
  }

  // INITIATOR must have explicit EventAccess for this event
  if (result.payload.role === "INITIATOR") {
    const access = await db.eventAccess.findFirst({
      where: { eventId, userId: result.payload.userId },
    });
    if (!access) {
      return {
        error: NextResponse.json({ error: "No tienes permiso para modificar este evento" }, { status: 403 }),
        payload: null,
      };
    }
    return result;
  }

  return {
    error: NextResponse.json({ error: "Sin permisos de puntuación" }, { status: 403 }),
    payload: null,
  };
}

/**
 * Require event creator or ADMIN role.
 * The user must be either ADMIN or the createdById of the event.
 */
export async function requireEventCreatorOrAdmin(
  request: Request,
  event: { createdById: string }
): Promise<AuthResult> {
  const result = await requireAuth(request);
  if (result.error) return result;
  if (!result.payload) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      payload: null,
    };
  }

  if (result.payload.role !== "ADMIN" && result.payload.userId !== event.createdById) {
    return {
      error: NextResponse.json({ error: "Only the event creator or admin can perform this action" }, { status: 403 }),
      payload: null,
    };
  }

  return result;
}

/**
 * Read a role's effective permission for a section.
 * ADMIN always has full access. Other roles read from RoleSectionPermission;
 * if no row exists, all flags default to false.
 */
export async function getSectionPermission(role: string, section: string): Promise<{
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}> {
  if (role === "ADMIN") {
    return { canView: true, canCreate: true, canEdit: true, canDelete: true };
  }
  const row = await db.roleSectionPermission.findUnique({
    where: { role_section: { role, section } },
  });
  return {
    canView: row?.canView ?? false,
    canCreate: row?.canCreate ?? false,
    canEdit: row?.canEdit ?? false,
    canDelete: row?.canDelete ?? false,
  };
}

/**
 * Require team access for a given action.
 *
 * - ADMIN: full access (always allowed) and the only role that can reassign
 *   team ownership (createdById).
 * - CREATOR / INITIATOR: the corresponding flag (canView / canCreate / canEdit /
 *   canDelete) on the "teams" section decides. Additionally, when `team` is
 *   provided (edit/delete a team, manage its players) the team must be
 *   assigned to the user by the administrator (createdById === userId);
 *   unassigned teams (createdById = null) are managed by ADMIN only.
 *
 * `action`: "view" | "create" | "edit" | "delete"
 * `team`: the team record (with createdById) — pass it for operations on a
 *   specific team so the assignment check is enforced.
 *
 * Returns { payload } on success, or { error } on denial.
 */
export async function requireTeamAccess(
  request: Request,
  action: "view" | "create" | "edit" | "delete",
  team?: { createdById: string | null } | null,
): Promise<AuthResult> {
  const result = await requireAuth(request);
  if (result.error) return result;
  if (!result.payload) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      payload: null,
    };
  }

  const role = result.payload.role;
  const userId = result.payload.userId;

  // ADMIN always has full access
  if (role === "ADMIN") return result;

  const perm = await getSectionPermission(role, "teams");
  const flag =
    action === "view" ? perm.canView
    : action === "create" ? perm.canCreate
    : action === "edit" ? perm.canEdit
    : perm.canDelete;

  if (!flag) {
    return {
      error: NextResponse.json(
        { error: `No tienes permiso para ${actionLabel(action)} equipos` },
        { status: 403 },
      ),
      payload: null,
    };
  }

  // Operations on a specific team require the team to be assigned to this
  // user by the administrator (ADMIN manages unassigned teams itself).
  if (team && team.createdById !== userId) {
    return {
      error: NextResponse.json(
        { error: "Solo puedes gestionar los equipos que te fueron asignados" },
        { status: 403 },
      ),
      payload: null,
    };
  }

  return result;
}

/**
 * Require access to a generic permission section (e.g. "payments").
 *
 * - ADMIN: full access (always allowed).
 * - CREATOR / INITIATOR: honors the RoleSectionPermission flags for the
 *   section; if no row exists, all flags default to false.
 *
 * `action`: "view" | "create" | "edit" | "delete"
 *
 * Returns { payload } on success, or { error } on denial.
 */
export async function requireSectionAccess(
  request: Request,
  section: string,
  action: "view" | "create" | "edit" | "delete",
): Promise<AuthResult> {
  const result = await requireAuth(request);
  if (result.error) return result;
  if (!result.payload) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      payload: null,
    };
  }

  if (result.payload.role === "ADMIN") return result;

  const perm = await getSectionPermission(result.payload.role, section);
  const flag =
    action === "view" ? perm.canView
    : action === "create" ? perm.canCreate
    : action === "edit" ? perm.canEdit
    : perm.canDelete;

  if (!flag) {
    return {
      error: NextResponse.json(
        { error: `No tienes permiso para ${actionLabel(action)} en esta sección` },
        { status: 403 },
      ),
      payload: null,
    };
  }

  return result;
}

function actionLabel(action: string): string {
  switch (action) {
    case "view": return "ver";
    case "create": return "crear";
    case "edit": return "editar";
    case "delete": return "eliminar";
    default: return "gestionar";
  }
}