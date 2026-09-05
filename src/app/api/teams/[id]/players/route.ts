import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamAccess } from "@/lib/event-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Listing a team's players requires the teams.canView flag (ADMIN always allowed).
    const { error } = await requireTeamAccess(request, "view");
    if (error) return error;

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
    const { id } = await params;

    const team = await db.team.findUnique({ where: { id } });
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Creating a player requires teams.canCreate (ADMIN always allowed) and,
    // for non-admin users, the team to be assigned to them.
    const { error } = await requireTeamAccess(request, "create", team);
    if (error) return error;

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