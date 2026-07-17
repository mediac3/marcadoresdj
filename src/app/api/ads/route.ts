import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCreatorOrAdmin } from "@/lib/event-auth";

const VALID_AD_TYPES = ["text", "image", "video"] as const;
const VALID_POSITIONS = ["top", "bottom", "left", "right"] as const;
const VALID_ORIENTATIONS = ["horizontal", "vertical"] as const;

export async function GET(request: Request) {
  const { error, payload } = await requireCreatorOrAdmin(request);
  if (error) return error;

  const where: Record<string, unknown> = {};

  // CREATOR isolation: only see own ads
  if (payload && payload.role === "CREATOR") {
    where.createdById = payload.userId;
  }

  const ads = await db.ad.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clicks: true } } },
  });

  return NextResponse.json({ success: true, ads });
}

export async function POST(request: Request) {
  const { error, payload } = await requireCreatorOrAdmin(request);
  if (error) return error;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, adType, content, position, linkUrl, orientation, isActive } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (!VALID_AD_TYPES.includes(adType)) {
    return NextResponse.json(
      { error: "adType must be one of: text, image, video" },
      { status: 400 }
    );
  }
  if (!VALID_POSITIONS.includes(position)) {
    return NextResponse.json(
      { error: "position must be one of: top, bottom, left, right" },
      { status: 400 }
    );
  }
  if (!VALID_ORIENTATIONS.includes(orientation)) {
    return NextResponse.json(
      { error: "orientation must be one of: horizontal, vertical" },
      { status: 400 }
    );
  }

  const ad = await db.ad.create({
    data: {
      title,
      adType,
      content,
      position,
      linkUrl: linkUrl || null,
      orientation,
      isActive: isActive ?? true,
      cityIds: Array.isArray(body.cityIds) ? body.cityIds.join(',') : (body.cityIds || ''),
      countdownSeconds: typeof body.countdownSeconds === 'number' ? Math.max(0, body.countdownSeconds) : 10,
      createdById: payload.userId,
    },
  });

  return NextResponse.json({ success: true, ad }, { status: 201 });
}