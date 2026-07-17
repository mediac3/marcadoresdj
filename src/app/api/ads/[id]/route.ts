import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

const VALID_AD_TYPES = ["text", "image", "video"];
const VALID_POSITIONS = ["top", "bottom", "left", "right"];
const VALID_ORIENTATIONS = ["horizontal", "vertical"];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, payload } = await requireCreatorOrAdmin(request);
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const existing = await db.ad.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }

  // CREATOR isolation: only edit own ads
  if (payload && payload.role === "CREATOR" && existing.createdById !== payload.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.adType !== undefined && !VALID_AD_TYPES.includes(body.adType)) {
    return NextResponse.json(
      { error: "adType must be one of: text, image, video" },
      { status: 400 }
    );
  }
  if (body.position !== undefined && !VALID_POSITIONS.includes(body.position)) {
    return NextResponse.json(
      { error: "position must be one of: top, bottom, left, right" },
      { status: 400 }
    );
  }
  if (
    body.orientation !== undefined &&
    !VALID_ORIENTATIONS.includes(body.orientation)
  ) {
    return NextResponse.json(
      { error: "orientation must be one of: horizontal, vertical" },
      { status: 400 }
    );
  }

  const ad = await db.ad.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.adType !== undefined && { adType: body.adType }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.position !== undefined && { position: body.position }),
      ...(body.linkUrl !== undefined && { linkUrl: body.linkUrl || null }),
      ...(body.orientation !== undefined && { orientation: body.orientation }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.cityIds !== undefined && { cityIds: Array.isArray(body.cityIds) ? body.cityIds.join(',') : (body.cityIds || '') }),
      ...(body.countdownSeconds !== undefined && { countdownSeconds: Math.max(0, body.countdownSeconds) }),
    },
  });

  return NextResponse.json({ success: true, ad });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, payload } = await requireCreatorOrAdmin(request);
  if (error) return error;

  const { id } = await params;

  const existing = await db.ad.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }

  // CREATOR isolation: only delete own ads
  if (payload && payload.role === "CREATOR" && existing.createdById !== payload.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.ad.delete({ where: { id } });

  return NextResponse.json({ success: true });
}