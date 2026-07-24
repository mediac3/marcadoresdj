import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

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
    const { name, label, icon, color, sortOrder, defaultValue, mvpWeight } = body;

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
        mvpWeight: typeof mvpWeight === "number" ? mvpWeight : 0,
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