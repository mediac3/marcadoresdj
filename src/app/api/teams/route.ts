import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const sportId = searchParams.get("sportId");
    const gender = searchParams.get("gender");
    const ageCategory = searchParams.get("ageCategory");

    const where: Record<string, unknown> = {};
    if (sportId) where.sportId = sportId;
    if (gender) where.gender = gender;
    if (ageCategory) where.ageCategory = ageCategory;

    const teams = await db.team.findMany({
      where,
      include: {
        sport: {
          select: { id: true, name: true, icon: true },
        },
        _count: {
          select: { players: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, teams });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { name, shortName, logo, sportId, gender, ageCategory } = body;

    if (!name || !sportId) {
      return NextResponse.json(
        { error: "Name and sportId are required" },
        { status: 400 }
      );
    }

    const sport = await db.sport.findUnique({ where: { id: sportId } });
    if (!sport) {
      return NextResponse.json(
        { error: "Sport not found" },
        { status: 404 }
      );
    }

    const team = await db.team.create({
      data: {
        name,
        shortName: shortName || null,
        logo: logo || null,
        sportId,
        gender: gender || "Mixto",
        ageCategory: ageCategory || "Libre",
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

    return NextResponse.json({ success: true, team }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}