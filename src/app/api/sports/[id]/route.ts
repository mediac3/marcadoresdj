import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

export async function PUT(
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

    const body = await request.json();
    const { name, icon, isActive } = body;

    const existing = await db.sport.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Sport not found" },
        { status: 404 }
      );
    }

    if (name && name !== existing.name) {
      const nameTaken = await db.sport.findUnique({ where: { name } });
      if (nameTaken) {
        return NextResponse.json(
          { error: "Sport with this name already exists" },
          { status: 409 }
        );
      }
    }

    const sport = await db.sport.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(icon !== undefined && { icon }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { actions: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ success: true, sport });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const existing = await db.sport.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Sport not found" },
        { status: 404 }
      );
    }

    await db.sport.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Sport deleted" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}