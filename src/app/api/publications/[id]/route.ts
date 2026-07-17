import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.publication.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
    }

    // CREATOR isolation: only edit own publications
    if (payload && payload.role === "CREATOR" && existing.createdById !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, content, imageUrl, type, isActive, order } = body;

    const validTypes = ["card", "article"];

    const updated = await db.publication.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(content !== undefined ? { content: String(content).trim() } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl?.trim() || null } : {}),
        ...(type !== undefined ? { type: validTypes.includes(type) ? type : "card" } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
      },
    });

    return NextResponse.json({ success: true, publication: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const { id } = await params;

    const existing = await db.publication.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
    }

    // CREATOR isolation: only delete own publications
    if (payload && payload.role === "CREATOR" && existing.createdById !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.publication.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}