import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSectionAccess } from "@/lib/event-auth";

/**
 * PUT /api/card-payments/[id]
 *
 * Manage a single card payment:
 *   body: { status?: "PAID" | "PENDING", amount?: number, note?: string, paidAt?: string (ISO, optional backdate) }
 *
 * - status PAID  → sets paidAt (now unless paidAt given) and paidById = current user
 * - status PENDING → clears paidAt / paidById
 * - amount (>= 0) and note are updated when provided
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, payload } = await requireSectionAccess(request, "payments", "edit");
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const payment = await db.cardPayment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!payment) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { status, amount, note, paidAt } = body as {
      status?: string;
      amount?: number;
      note?: string | null;
      paidAt?: string;
    };

    if (status != null && status !== "PAID" && status !== "PENDING") {
      return NextResponse.json({ error: "Estado inválido (PAID o PENDING)" }, { status: 400 });
    }
    if (amount != null && (typeof amount !== "number" || isNaN(amount) || amount < 0)) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};

    if (typeof amount === "number") data.amount = amount;
    if (note !== undefined) data.note = note || null;

    if (status === "PAID") {
      data.status = "PAID";
      // Keep the original paidAt when it was already paid and no new date given
      data.paidAt = paidAt ? new Date(paidAt) : (payment.status === "PAID" ? undefined : new Date());
      data.paidById = payload.userId;
    } else if (status === "PENDING") {
      data.status = "PENDING";
      data.paidAt = null;
      data.paidById = null;
    }

    // Avoid passing undefined values to Prisma
    for (const key of Object.keys(data)) {
      if (data[key] === undefined) delete data[key];
    }

    const updated = await db.cardPayment.update({
      where: { id },
      data,
      include: {
        paidBy: { select: { username: true, name: true } },
        eventAction: {
          select: {
            id: true,
            actionType: true,
            actionLabel: true,
            playerId: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, payment: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
