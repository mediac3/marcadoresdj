import { NextResponse } from "next/server";
import { randomUUID, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";

/**
 * POST /api/public/events/create
 *
 * Public endpoint – no auth required.
 *
 * Lets a visitor create a public event after accepting the Terms & Conditions.
 * A throwaway CREATOR user is generated so the visitor can later manage the
 * event; its credentials are returned ONCE (the client stores them in
 * localStorage). Mirrors the validation of POST /api/events.
 *
 * Body:
 *   - termsAccepted: boolean (required if termsEnabled === "true")
 *   - termsVersion: number|string (must match current version when enforced)
 *   - sportId, teamAId, teamBId (required)
 *   - name?, location?, countryId?, departmentId?, cityId?, scheduledAt?,
 *     streamingUrl?, streamingKey?, isPublic (forced true),
 *     tournamentName?, phase?, phaseOrder?, tournamentPhaseId?
 *
 * Response: { success, event, user: {id, username}, password, token, termsVersion }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      termsAccepted,
      termsVersion,
      sportId,
      teamAId,
      teamBId,
      name,
      location,
      countryId,
      departmentId,
      cityId,
      scheduledAt,
      streamingUrl,
      streamingKey,
      tournamentName,
      phase,
      phaseOrder,
      tournamentPhaseId,
    } = body;

    /* ── 1. Terms acceptance validation ── */
    const settings = await db.siteSetting.findMany();
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
    const termsEnabled = settingsMap.get("termsEnabled") === "true";
    const currentTermsVersion = parseInt(settingsMap.get("termsVersion") ?? "0", 10) || 0;

    if (termsEnabled) {
      if (!termsAccepted) {
        return NextResponse.json(
          { error: "Debes aceptar los términos y condiciones para continuar" },
          { status: 403 },
        );
      }
      const submittedVersion = parseInt(String(termsVersion ?? "0"), 10) || 0;
      if (currentTermsVersion > 0 && submittedVersion !== currentTermsVersion) {
        return NextResponse.json(
          { error: "La versión de los términos ha cambiado; revísalos y acepta de nuevo" },
          { status: 403 },
        );
      }
    }

    /* ── 2. Event field validation (mirrors POST /api/events) ── */
    if (!sportId || !teamAId || !teamBId) {
      return NextResponse.json(
        { error: "sportId, teamAId, and teamBId are required" },
        { status: 400 },
      );
    }

    const sport = await db.sport.findUnique({ where: { id: sportId } });
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 });
    }

    const [teamA, teamB] = await Promise.all([
      db.team.findUnique({ where: { id: teamAId } }),
      db.team.findUnique({ where: { id: teamBId } }),
    ]);
    if (!teamA) {
      return NextResponse.json({ error: "Team A not found" }, { status: 404 });
    }
    if (!teamB) {
      return NextResponse.json({ error: "Team B not found" }, { status: 404 });
    }
    if (teamA.sportId !== sportId || teamB.sportId !== sportId) {
      return NextResponse.json(
        { error: "Teams must belong to the specified sport" },
        { status: 400 },
      );
    }
    if (teamA.id === teamB.id) {
      return NextResponse.json(
        { error: "Team A and Team B must be different" },
        { status: 400 },
      );
    }

    /* ── 3. Create guest CREATOR user ── */
    // Generate a unique username and a strong random password.
    const guestUsername = `invitado-${randomUUID().slice(0, 8)}`;
    const plainPassword = generatePassword(12);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const guestUser = await db.user.create({
      data: {
        username: guestUsername,
        password: hashedPassword,
        role: "CREATOR",
        name: "Visitante",
        isActive: true,
      },
    });

    /* ── 4. Resolve tournament phase (mirrors POST /api/events) ── */
    let resolvedTournamentName = tournamentName || null;
    let resolvedPhase = phase || null;
    let resolvedPhaseOrder = phaseOrder !== undefined ? phaseOrder : 0;
    let resolvedPhaseId: string | null = tournamentPhaseId || null;

    if (resolvedPhaseId) {
      const phaseRecord = await db.tournamentPhase.findUnique({
        where: { id: resolvedPhaseId },
        include: { tournament: { select: { name: true } } },
      });
      if (phaseRecord) {
        resolvedTournamentName = phaseRecord.tournament.name;
        resolvedPhase = phaseRecord.name;
        resolvedPhaseOrder = phaseRecord.order;
      } else {
        resolvedPhaseId = null;
      }
    }

    /* ── 5. Create the event (always public) ── */
    const event = await db.event.create({
      data: {
        name: name || null,
        sportId,
        teamAId,
        teamBId,
        location: location || null,
        countryId: countryId || null,
        departmentId: departmentId || null,
        cityId: cityId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        streamingUrl: streamingUrl || null,
        streamingKey: streamingKey || null,
        isPublic: true,
        status: "SCHEDULED",
        createdById: guestUser.id,
        tournamentName: resolvedTournamentName,
        phase: resolvedPhase,
        phaseOrder: resolvedPhaseOrder,
        tournamentPhaseId: resolvedPhaseId,
      },
      include: {
        sport: { select: { id: true, name: true, icon: true } },
        teamA: {
          include: {
            players: {
              select: { id: true, name: true, number: true, position: true, nickname: true },
              orderBy: { number: "asc" },
            },
          },
        },
        teamB: {
          include: {
            players: {
              select: { id: true, name: true, number: true, position: true, nickname: true },
              orderBy: { number: "asc" },
            },
          },
        },
      },
    });

    /* ── 6. Issue token for the guest user ── */
    const token = await signToken({ userId: guestUser.id, role: guestUser.role });

    return NextResponse.json(
      {
        success: true,
        event,
        user: { id: guestUser.id, username: guestUser.username },
        // Password is returned ONCE so the visitor can save it; it is never
        // recoverable afterwards (only the bcrypt hash is stored).
        password: plainPassword,
        token,
        termsVersion: currentTermsVersion,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * Generate a human-friendly strong password: alphanumeric, unambiguous chars.
 */
function generatePassword(length: number): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[randomInt(0, chars.length)];
  }
  return out;
}
