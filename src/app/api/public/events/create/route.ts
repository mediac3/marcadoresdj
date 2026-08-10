import { NextResponse } from "next/server";
import { randomUUID, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { isValidE164 } from "@/lib/phone";

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
 * Body (v3 — WhatsApp phone + credits):
 *   - phone: string (required, E.164 digits only, e.g. "573226575422")
 *   - termsAccepted: boolean (required if termsEnabled === "true")
 *   - termsVersion: number|string (must match current version when enforced)
 *   - sportId (required)
 *   - Either existing teams:
 *       teamAId, teamBId  (required if not creating new teams)
 *     OR new teams:
 *       teamA: { name: string, players?: [{ name, number, position }] }
 *       teamB: { name: string, players?: [{ name, number, position }] }
 *   - name?, location?, countryId?, departmentId?, cityId?, scheduledAt?,
 *     streamingUrl?, streamingKey?, isPublic (forced true),
 *     tournamentName?, phase?, phaseOrder?, tournamentPhaseId?
 *
 * Phone/credits rules:
 *   - A phone is unique per visitor. If it already belongs to a guest CREATOR,
 *     the existing account is reused and one credit is decremented.
 *   - If the phone is new, a new guest CREATOR is created with
 *     (guestInitialCredits - 1) credits.
 *   - If credits <= 0, creation is rejected with 403.
 *
 * Response: { success, event, user: {id, username}, password, token, termsVersion, credits, lastCredit }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      phone,
      termsAccepted,
      termsVersion,
      sportId,
      teamAId,
      teamBId,
      // New-team payloads (v2)
      teamA: newTeamA,
      teamB: newTeamB,
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
    const guestInitialCredits = parseInt(settingsMap.get("guestInitialCredits") ?? "5", 10) || 5;

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

    /* ── 1b. Phone validation (required) ── */
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
    if (!normalizedPhone || !isValidE164(normalizedPhone)) {
      return NextResponse.json(
        { error: "Debes ingresar un número de WhatsApp válido" },
        { status: 400 },
      );
    }

    /* ── 2. Sport validation ── */
    if (!sportId) {
      return NextResponse.json(
        { error: "sportId is required" },
        { status: 400 },
      );
    }
    const sport = await db.sport.findUnique({ where: { id: sportId } });
    if (!sport) {
      return NextResponse.json({ error: "Sport not found" }, { status: 404 });
    }

    /* ── 3. Resolve guest user by phone (reuse) or create new (with credits) ──
       A phone is unique per visitor. If it exists, reuse that account and
       decrement one credit. If new, create a guest CREATOR with
       (guestInitialCredits - 1) credits. This account owns any new teams. */
    const existingUser = await db.user.findUnique({
      where: { phone: normalizedPhone },
    });

    let guestUserId: string;
    let guestUsername: string;
    let plainPassword: string;
    let remainingCredits: number;
    let lastCredit: boolean;

    if (existingUser) {
      // Reuse the existing guest account.
      if (existingUser.credits <= 0) {
        return NextResponse.json(
          { error: "No tienes créditos disponibles para crear más eventos. Solicita más créditos por WhatsApp." },
          { status: 403 },
        );
      }
      remainingCredits = existingUser.credits - 1;
      lastCredit = remainingCredits === 0;
      await db.user.update({
        where: { id: existingUser.id },
        data: { credits: remainingCredits },
      });
      guestUserId = existingUser.id;
      guestUsername = existingUser.username;
      // No new password for a reused account; issue a fresh one so the visitor
      // can always access the event they just created.
      plainPassword = generatePassword(12);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      await db.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword },
      });
    } else {
      // New guest CREATOR account.
      guestUsername = `invitado-${randomUUID().slice(0, 8)}`;
      plainPassword = generatePassword(12);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      remainingCredits = Math.max(0, guestInitialCredits - 1);
      lastCredit = remainingCredits === 0;
      const created = await db.user.create({
        data: {
          username: guestUsername,
          password: hashedPassword,
          role: "CREATOR",
          name: "Visitante",
          isActive: true,
          phone: normalizedPhone,
          credits: remainingCredits,
        },
      });
      guestUserId = created.id;
    }

    /* guestUser is referenced below for the token; keep a minimal object. */
    const guestUser = { id: guestUserId, username: guestUsername, role: "CREATOR" as const };

    /* ── 4. Resolve Team A (existing id OR create new with players) ── */
    let resolvedTeamAId: string;
    if (newTeamA && typeof newTeamA === "object" && typeof newTeamA.name === "string" && newTeamA.name.trim()) {
      const created = await db.team.create({
        data: { name: newTeamA.name.trim(), sportId },
      });
      resolvedTeamAId = created.id;
      // Attach optional players
      const playersA = normalizePlayers(newTeamA.players);
      if (playersA.length > 0) {
        await db.player.createMany({
          data: playersA.map((p) => ({
            name: p.name,
            number: p.number,
            position: p.position,
            teamId: created.id,
          })),
        });
      }
    } else if (teamAId) {
      resolvedTeamAId = teamAId;
    } else {
      return NextResponse.json(
        { error: "Provide teamAId or teamA { name, players? }" },
        { status: 400 },
      );
    }

    /* ── 5. Resolve Team B ── */
    let resolvedTeamBId: string;
    if (newTeamB && typeof newTeamB === "object" && typeof newTeamB.name === "string" && newTeamB.name.trim()) {
      const created = await db.team.create({
        data: { name: newTeamB.name.trim(), sportId },
      });
      resolvedTeamBId = created.id;
      const playersB = normalizePlayers(newTeamB.players);
      if (playersB.length > 0) {
        await db.player.createMany({
          data: playersB.map((p) => ({
            name: p.name,
            number: p.number,
            position: p.position,
            teamId: created.id,
          })),
        });
      }
    } else if (teamBId) {
      resolvedTeamBId = teamBId;
    } else {
      return NextResponse.json(
        { error: "Provide teamBId or teamB { name, players? }" },
        { status: 400 },
      );
    }

    if (resolvedTeamAId === resolvedTeamBId) {
      return NextResponse.json(
        { error: "Team A and Team B must be different" },
        { status: 400 },
      );
    }

    /* ── 6. Validate existing teams belong to the sport ── */
    if (teamAId || teamBId) {
      const [teamA, teamB] = await Promise.all([
        teamAId ? db.team.findUnique({ where: { id: resolvedTeamAId } }) : Promise.resolve(null),
        teamBId ? db.team.findUnique({ where: { id: resolvedTeamBId } }) : Promise.resolve(null),
      ]);
      if (teamAId && !teamA) {
        return NextResponse.json({ error: "Team A not found" }, { status: 404 });
      }
      if (teamBId && !teamB) {
        return NextResponse.json({ error: "Team B not found" }, { status: 404 });
      }
      if (teamA && teamA.sportId !== sportId) {
        return NextResponse.json({ error: "Team A must belong to the specified sport" }, { status: 400 });
      }
      if (teamB && teamB.sportId !== sportId) {
        return NextResponse.json({ error: "Team B must belong to the specified sport" }, { status: 400 });
      }
    }

    /* ── 7. Resolve tournament phase ── */
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

    /* ── 8. Create the event (always public) ── */
    const event = await db.event.create({
      data: {
        name: name || null,
        sportId,
        teamAId: resolvedTeamAId,
        teamBId: resolvedTeamBId,
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

    /* ── 9. Record terms acceptance audit (if terms are enforced) ── */
    if (termsEnabled) {
      const forwarded = request.headers.get("x-forwarded-for");
      const ipAddress = forwarded ? forwarded.split(",")[0].trim() : null;
      const userAgent = request.headers.get("user-agent");
      await db.eventTermsAcceptance.create({
        data: {
          eventId: event.id,
          guestUserId: guestUser.id,
          termsVersion: currentTermsVersion,
          ipAddress,
          userAgent,
        },
      });
    }

    /* ── 10. Issue token for the guest user ── */
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
        credits: remainingCredits,
        lastCredit,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[public/events/create] error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * Normalize and validate an incoming players array for a new team.
 * Drops incomplete rows (missing name/number/position) so "0 players" is valid.
 */
function normalizePlayers(
  players: unknown,
): Array<{ name: string; number: number; position: string }> {
  if (!Array.isArray(players)) return [];
  const out: Array<{ name: string; number: number; position: string }> = [];
  for (const raw of players) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const name = typeof p.name === "string" ? p.name.trim() : "";
    const position = typeof p.position === "string" ? p.position.trim() : "";
    const num = typeof p.number === "number" ? p.number : parseInt(String(p.number ?? ""), 10);
    if (!name || !position || Number.isNaN(num)) continue; // skip incomplete rows
    out.push({ name, number: num, position });
  }
  return out;
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
