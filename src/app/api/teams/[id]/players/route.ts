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

    const team = await db.team.findUnique({ where: { id } });
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    const players = await db.player.findMany({
      where: { teamId: id },
      orderBy: [{ number: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, players });
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

    if (payload.role !== "ADMIN" && payload.role !== "CREATOR") {
      return NextResponse.json(
        { error: "Creator or Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const team = await db.team.findUnique({ where: { id } });
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      number,
      position,
      photo,
      nickname,
      birthDate,
      nationality,
      height,
      weight,
    } = body;

    if (!name || number === undefined || !position) {
      return NextResponse.json(
        { error: "Name, number, and position are required" },
        { status: 400 }
      );
    }

    if (typeof number !== "number" || !Number.isInteger(number)) {
      return NextResponse.json(
        { error: "Number must be an integer" },
        { status: 400 }
      );
    }

    const player = await db.player.create({
      data: {
        name,
        number,
        position,
        photo: photo || null,
        nickname: nickname || null,
        birthDate: birthDate || null,
        nationality: nationality || null,
        height: height || null,
        weight: weight || null,
        teamId: id,
      },
    });

    return NextResponse.json({ success: true, player }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}