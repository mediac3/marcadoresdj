import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

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
    const { players } = body;

    if (!Array.isArray(players) || players.length === 0) {
      return NextResponse.json(
        { error: "players array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (players.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 players per import" },
        { status: 400 }
      );
    }

    // Validate each player entry
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.name || typeof p.name !== "string" || !p.name.trim()) {
        return NextResponse.json(
          { error: `Fila ${i + 2}: Nombre es requerido` },
          { status: 400 }
        );
      }
      if (p.number === undefined || p.number === null || typeof p.number !== "number") {
        return NextResponse.json(
          { error: `Fila ${i + 2}: Numero es requerido` },
          { status: 400 }
        );
      }
      if (!p.position || typeof p.position !== "string" || !p.position.trim()) {
        return NextResponse.json(
          { error: `Fila ${i + 2}: Posicion es requerida` },
          { status: 400 }
        );
      }
    }

    // Create all players in a transaction
    const created = await db.$transaction(
      players.map((p: Record<string, unknown>) =>
        db.player.create({
          data: {
            name: String(p.name).trim(),
            number: Number(p.number),
            position: String(p.position).trim(),
            photo: typeof p.photo === "string" && p.photo.trim() ? p.photo.trim() : null,
            nickname: typeof p.nickname === "string" && p.nickname.trim() ? p.nickname.trim() : null,
            birthDate: typeof p.birthDate === "string" && p.birthDate.trim() ? p.birthDate.trim() : null,
            nationality: typeof p.nationality === "string" && p.nationality.trim() ? p.nationality.trim() : null,
            height: typeof p.height === "string" && p.height.trim() ? p.height.trim() : null,
            weight: typeof p.weight === "string" && p.weight.trim() ? p.weight.trim() : null,
            teamId: id,
          },
        })
      )
    );

    return NextResponse.json(
      { success: true, count: created.length, players: created },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}