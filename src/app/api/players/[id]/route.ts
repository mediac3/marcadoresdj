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

    if (payload.role !== "ADMIN" && payload.role !== "CREATOR") {
      return NextResponse.json(
        { error: "Creator or Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await db.player.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Player not found" },
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

    if (number !== undefined && (typeof number !== "number" || !Number.isInteger(number))) {
      return NextResponse.json(
        { error: "Number must be an integer" },
        { status: 400 }
      );
    }

    const player = await db.player.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(number !== undefined && { number }),
        ...(position && { position }),
        ...(photo !== undefined && { photo: photo || null }),
        ...(nickname !== undefined && { nickname: nickname || null }),
        ...(birthDate !== undefined && { birthDate: birthDate || null }),
        ...(nationality !== undefined && { nationality: nationality || null }),
        ...(height !== undefined && { height: height || null }),
        ...(weight !== undefined && { weight: weight || null }),
      },
    });

    return NextResponse.json({ success: true, player });
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

    if (payload.role !== "ADMIN" && payload.role !== "CREATOR") {
      return NextResponse.json(
        { error: "Creator or Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await db.player.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    await db.player.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Player deleted" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}