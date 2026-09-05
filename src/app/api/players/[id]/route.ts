import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamAccess } from "@/lib/event-auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.player.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Editing a player requires teams.canEdit (ADMIN always allowed) and, for
    // non-admin users, the player's team to be assigned to them.
    const team = await db.team.findUnique({
      where: { id: existing.teamId },
      select: { createdById: true },
    });
    const { error } = await requireTeamAccess(request, "edit", team);
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
    const { id } = await params;

    const existing = await db.player.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Deleting a player requires teams.canDelete (ADMIN always allowed) and,
    // for non-admin users, the player's team to be assigned to them.
    const team = await db.team.findUnique({
      where: { id: existing.teamId },
      select: { createdById: true },
    });
    const { error } = await requireTeamAccess(request, "delete", team);
    if (error) return error;

    await db.player.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Player deleted" });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}