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

    const team = await db.team.findUnique({
      where: { id },
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        players: {
          orderBy: [{ number: "asc" }, { name: "asc" }],
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, team });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    if (payload.role !== "ADMIN" && payload.role !== "CREATOR") {
      return NextResponse.json(
        { error: "Creator or Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await db.team.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, shortName, logo, sportId, gender, ageCategory } = body;

    if (sportId) {
      const sport = await db.sport.findUnique({ where: { id: sportId } });
      if (!sport) {
        return NextResponse.json(
          { error: "Sport not found" },
          { status: 404 }
        );
      }
    }

    const team = await db.team.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(shortName !== undefined && { shortName: shortName || null }),
        ...(logo !== undefined && { logo: logo || null }),
        ...(sportId && { sportId }),
        ...(gender !== undefined && { gender }),
        ...(ageCategory !== undefined && { ageCategory }),
      },
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        _count: {
          select: { players: true },
        },
      },
    });

    return NextResponse.json({ success: true, team });
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

    const existing = await db.team.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    await db.team.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Team deleted" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}