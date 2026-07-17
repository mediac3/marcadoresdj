import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireInitiatorOrAbove } from "@/lib/event-auth";

const templates: Record<string, string[]> = {
  GOAL: [
    "⚽ ¡GOOOOL! {playerName} marca para {teamName}! Minuto {minute}",
    "⚽ ¡GOLAZO! {playerName} anota en el minuto {minute}. {teamName} celebra",
    "⚽ ¡Qué golazo de {playerName}! {teamName} abre el marcador en el minuto {minute}",
    "⚽ ¡GOL! {playerName} no perdona y {teamName} se pone adelante. Minuto {minute}",
  ],
  PENALTY_GOAL: [
    "⚽ ¡GOL DE PENAL! {playerName} transforma el penal para {teamName}. Minuto {minute}",
    "⚽ Penalty convertido por {playerName}. {teamName} marca desde los doce pasos. Minuto {minute}",
  ],
  OWN_GOAL: [
    "⚽ ¡GOL EN CONTRA! {playerName} de {teamName} mete el gol en su propia portería. Minuto {minute}",
    "⚽ Autogol de {playerName} ({teamName}). Minuto {minute}. El balón se coló en la red propia",
  ],
  FREE_KICK_GOAL: [
    "⚽ ¡GOL DE TIRO LIBRE! {playerName} clava un libre directo para {teamName}. Minuto {minute}",
    "⚽ Tiro libre magistral de {playerName}. {teamName} anota. Minuto {minute}",
  ],
  FUTSAL_GOAL: [
    "⚽ ¡GOL en fútsol! {playerName} marca para {teamName}. Minuto {minute}",
    "⚽ {playerName} anota en fútsol para {teamName}. Minuto {minute}",
  ],
  FUTSAL_GOALKEEPER: [
    "⚽ ¡El portero {playerName} marca! Golazo del guardameta de {teamName}. Minuto {minute}",
    "⚽ ¡GOL DEL PORTERO! {playerName} ({teamName}) sorprende y anota. Minuto {minute}",
  ],
  YELLOW_CARD: [
    "🟨 Tarjeta amarilla para {playerName} de {teamName} en el minuto {minute}",
    "🟨 El árbitro amonesta a {playerName} ({teamName}). Minuto {minute}",
    "🟨 Amonestación para {playerName} de {teamName}. Minuto {minute}",
  ],
  RED_CARD: [
    "🟥 ¡TARJETA ROJA! {playerName} de {teamName} es expulsado en el minuto {minute}",
    "🟥 Expulsión para {playerName} ({teamName}). Minuto {minute}. Queda con uno menos",
    "🟥 ¡Roja directa! {playerName} ({teamName}) sale al vestuario. Minuto {minute}",
  ],
  SUBSTITUTION: [
    "🔄 Cambio en {teamName}: entra {playerName}. Minuto {minute}",
    "🔄 {teamName} realiza sustitución. {playerName} ingresa al campo. Minuto {minute}",
    "🔄 Sustitución en {teamName}: {playerName} toma el campo. Minuto {minute}",
  ],
  CORNER: [
    "📐 Córner para {teamName}. Minuto {minute}",
    "📐 Saque de esquina a favor de {teamName}. Minuto {minute}",
  ],
  OFFSIDE: [
    "🚫 Fuera de juego para {teamName}. Minuto {minute}",
    "🚫 El árbitro marca fuera de juego contra {teamName}. Minuto {minute}",
  ],
  FOUL: [
    "⚠️ Fallo cometido por {playerName} de {teamName}. Minuto {minute}",
    "⚠️ Falta de {playerName} ({teamName}). Minuto {minute}",
  ],
  FREE_KICK: [
    "📐 Tiro libre a favor de {teamName} por falta de {playerName}. Minuto {minute}",
    "📐 Falta cometida. Tiro libre para {teamName}. Minuto {minute}",
  ],
  PENALTY: [
    "⚽ ¡Penal para {teamName}! Falta en el área. Minuto {minute}",
    "⚽ El árbitro señala el punto penal a favor de {teamName}. Minuto {minute}",
  ],
  INJURY: [
    "🏥 Lesión de {playerName} de {teamName}. Se atiende en el campo. Minuto {minute}",
    "🏥 {playerName} ({teamName}) sufre una lesión. Atención médica en el minuto {minute}",
  ],
  TIMEOUT: [
    "⏸️ Tiempo muerto solicitado por {teamName}. Minuto {minute}",
    "⏸️ {teamName} pide tiempo muerto. Minuto {minute}",
  ],
  TWO_POINTS: [
    "🏀 ¡{playerName} anota dos puntos para {teamName}! Minuto {minute}",
    "🏀 Canasta de dos puntos de {playerName} ({teamName}). Minuto {minute}",
  ],
  THREE_POINTS: [
    "🏀 ¡TRIPLE! {playerName} encesta desde afuera para {teamName}. Minuto {minute}",
    "🏀 ¡Tres puntos de {playerName}! {teamName} se prende. Minuto {minute}",
  ],
  FREE_THROW: [
    "🏀 Tiro libre convertido por {playerName} ({teamName}). Minuto {minute}",
    "🏀 {playerName} anota el tiro libre para {teamName}. Minuto {minute}",
  ],
  REBOUND: [
    "🏀 Rebote capturado por {playerName} de {teamName}. Minuto {minute}",
  ],
  ASSIST: [
    "🎯 Asistencia de {playerName} para {teamName}. Minuto {minute}",
  ],
  STEAL: [
    "🤏 Robo de balón por {playerName} de {teamName}. Minuto {minute}",
  ],
  BLOCK: [
    "🛑 ¡TAPÓN! {playerName} ({teamName}) bloquea el tiro. Minuto {minute}",
  ],
  TURNOVER: [
    "🔄 Pérdida de balón de {playerName} ({teamName}). Minuto {minute}",
  ],
  START_PERIOD: [
    "⏱️ Comienza el {minute}° periodo / {half}° mitad",
    "⏱️ Arranca el {minute}° periodo",
  ],
  END_PERIOD: [
    "⏱️ Finaliza el {minute}° periodo / {half}° mitad",
    "⏱️ Se termina el {minute}° periodo",
  ],
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value || "");
  }
  return result;
}

function generateComment(
  actionType: string,
  actionLabel: string,
  playerName?: string,
  teamName?: string,
  minute?: number | null,
  half?: string | null
): string {
  const vars: Record<string, string> = {
    playerName: playerName || "Jugador",
    teamName: teamName || "Equipo",
    minute: minute !== null && minute !== undefined ? String(minute) : "?",
    half: half || "?",
  };

  const typeTemplates = templates[actionType];

  if (typeTemplates && typeTemplates.length > 0) {
    const randomIndex = Math.floor(Math.random() * typeTemplates.length);
    return fillTemplate(typeTemplates[randomIndex], vars);
  }

  // Fallback template for unknown action types
  if (playerName && teamName) {
    return `${actionLabel}: ${playerName} (${teamName}). Minuto ${vars.minute}`;
  }
  if (teamName) {
    return `${actionLabel} para ${teamName}. Minuto ${vars.minute}`;
  }
  return `${actionLabel}. Minuto ${vars.minute}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireInitiatorOrAbove(request);
    if (authError) return authError;

    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      actionType,
      actionLabel,
      playerName,
      teamName,
      minute,
      half,
      actionId,
    } = body;

    if (!actionType || !actionLabel) {
      return NextResponse.json(
        { error: "actionType and actionLabel are required" },
        { status: 400 }
      );
    }

    const content = generateComment(
      actionType,
      actionLabel,
      playerName,
      teamName || undefined,
      minute,
      half
    );

    const comment = await db.comment.create({
      data: {
        eventId: id,
        content,
        isAI: true,
        actionId: actionId || null,
      },
    });

    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}