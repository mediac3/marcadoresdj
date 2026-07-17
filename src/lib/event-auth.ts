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