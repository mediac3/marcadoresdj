import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

export async function GET(request: Request) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;

    const where: Record<string, unknown> = {};

    // CREATOR isolation: only see own publications
    if (payload && payload.role === "CREATOR") {
      where.createdById = payload.userId;
    }

    const publications = await db.publication.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, publications });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, payload } = await requireCreatorOrAdmin(request);
    if (error) return error;
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, imageUrl, type, isActive, order } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "El contenido es obligatorio" }, { status: 400 });
    }

    const validTypes = ["card", "article"];
    const pubType = validTypes.includes(type) ? type : "card";

    const publication = await db.publication.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        imageUrl: imageUrl?.trim() || null,
        type: pubType,
        isActive: isActive ?? true,
        order: typeof order === "number" ? order : 0,
        createdById: payload.userId,
      },
    });

    return NextResponse.json({ success: true, publication }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}