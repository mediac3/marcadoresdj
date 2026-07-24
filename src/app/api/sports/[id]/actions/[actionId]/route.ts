import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; actionId: string }> }
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

    const { id, actionId } = await params;

    const existing = await db.sportAction.findUnique({
      where: { id: actionId },
    });
    if (!existing || existing.sportId !== id) {
      return NextResponse.json(
        { error: "Action not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, label, icon, color, sortOrder, defaultValue, mvpWeight } = body;

    if (name && name !== existing.name) {
      const nameTaken = await db.sportAction.findUnique({
        where: { name_sportId: { name, sportId: id } },
      });
      if (nameTaken) {
        return NextResponse.json(
          { error: "Action with this name already exists for this sport" },
          { status: 409 }
        );
      }
    }

    const action = await db.sportAction.update({
      where: { id: actionId },
      data: {
        ...(name && { name }),
        ...(label && { label }),
        ...(icon && { icon }),
        ...(color !== undefined && { color }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(defaultValue !== undefined && { defaultValue }),
        ...(mvpWeight !== undefined && { mvpWeight }),
      },
    });

    return NextResponse.json({ success: true, action });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; actionId: string }> }
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

    const { id, actionId } = await params;

    const existing = await db.sportAction.findUnique({
      where: { id: actionId },
    });
    if (!existing || existing.sportId !== id) {
      return NextResponse.json(
        { error: "Action not found" },
        { status: 404 }
      );
    }

    await db.sportAction.delete({ where: { id: actionId } });

    return NextResponse.json({ success: true, message: "Action deleted" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}