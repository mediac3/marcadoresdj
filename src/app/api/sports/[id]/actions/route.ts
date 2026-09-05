import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { requireSectionAccess } from "@/lib/event-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Authorization token is required" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const sport = await db.sport.findUnique({ where: { id } });
    if (!sport) {
      return NextResponse.json(
        { error: "Sport not found" },
        { status: 404 }
      );
    }

    const actions = await db.sportAction.findMany({
      where: { sportId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ success: true, actions });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: "Authorization token is required" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (payload.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const sport = await db.sport.findUnique({ where: { id } });
    if (!sport) {
      return NextResponse.json(
        { error: "Sport not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, label, icon, color, sortOrder, defaultValue } = body;

    if (!name || !label || !icon) {
      return NextResponse.json(
        { error: "Name, label, and icon are required" },
        { status: 400 }
      );
    }

    const existing = await db.sportAction.findUnique({
      where: { name_sportId: { name, sportId: id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Action with this name already exists for this sport" },
        { status: 409 }
      );
    }

    const action = await db.sportAction.create({
      data: {
        name,
        label,
        icon,
        color: color || "#ffffff",
        sortOrder: sortOrder ?? 0,
        defaultValue: typeof defaultValue === "number" ? defaultValue : 1,
        sportId: id,
      },
    });

    return NextResponse.json({ success: true, action }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sports/[id]/actions
 * Update card config (isCard / cardAmount) of an existing SportAction.
 * Guarded by the "payments" section so Creators with payment-edit access
 * can manage card tariffs; ADMIN always allowed.
 * Body: { actionId: string, isCard?: boolean, cardAmount?: number }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireSectionAccess(request, "payments", "edit");
    if (error) return error;

    const { id } = await params;

    const sport = await db.sport.findUnique({ where: { id } });
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 });
    }

    const body = await request.json();
    const { actionId, isCard, cardAmount } = body as {
      actionId?: string;
      isCard?: boolean;
      cardAmount?: number;
    };

    if (!actionId) {
      return NextResponse.json({ error: "actionId es requerido" }, { status: 400 });
    }
    if (cardAmount != null && (typeof cardAmount !== "number" || isNaN(cardAmount) || cardAmount < 0)) {
      return NextResponse.json({ error: "cardAmount inválido" }, { status: 400 });
    }

    const action = await db.sportAction.findUnique({
      where: { id: actionId },
    });
    if (!action || action.sportId !== id) {
      return NextResponse.json(
        { error: "Acción no encontrada en este deporte" },
        { status: 404 }
      );
    }

    const data: { isCard?: boolean; cardAmount?: number } = {};
    if (typeof isCard === "boolean") data.isCard = isCard;
    if (typeof cardAmount === "number") data.cardAmount = cardAmount;

    const updated = await db.sportAction.update({
      where: { id: actionId },
      data,
    });

    return NextResponse.json({ success: true, action: updated });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}