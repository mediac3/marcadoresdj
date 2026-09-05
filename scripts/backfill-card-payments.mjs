/**
 * Backfill script: prepare an existing database for card payments.
 *
 * 1. Marks well-known card SportActions as isCard=true with a default fine
 *    amount (only if they are not already flagged).
 * 2. Creates PENDING CardPayments for every card EventAction that does not
 *    have one yet (amount = current SportAction.cardAmount).
 *
 * Idempotent: safe to run multiple times.
 *
 * Run: node scripts/backfill-card-payments.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Well-known card actions per sport-agnostic action name → default fine (COP)
const KNOWN_CARDS = {
  YELLOW_CARD: 5000,
  RED_CARD: 20000,
  FUTSAL_YELLOW: 5000,
  FUTSAL_BLUE: 10000,
  FUTSAL_RED: 20000,
};

async function main() {
  console.log('=== Backfill de pagos de tarjetas ===\n');

  // ── Step 1: flag known card actions ──
  const sports = await db.sport.findMany({
    include: { actions: true },
  });

  let flagged = 0;
  for (const sport of sports) {
    for (const action of sport.actions) {
      if (KNOWN_CARDS[action.name] != null && !action.isCard) {
        await db.sportAction.update({
          where: { id: action.id },
          data: { isCard: true, cardAmount: action.cardAmount || KNOWN_CARDS[action.name] },
        });
        console.log(`🟨 ${sport.name} → ${action.label} (${action.name}) marcada como tarjeta, tarifa ${KNOWN_CARDS[action.name]}`);
        flagged++;
      }
    }
  }
  console.log(`\nTarjetas marcadas: ${flagged}`);

  // ── Step 2: create missing pending payments ──
  const cardActions = await db.sportAction.findMany({ where: { isCard: true } });
  const cardTypeBySport = new Map(); // `${sportId}:${actionType}` → amount
  for (const ca of cardActions) {
    cardTypeBySport.set(`${ca.sportId}:${ca.name}`, ca.cardAmount);
  }

  const events = await db.event.findMany({
    select: { id: true, sportId: true },
  });
  const sportByEvent = new Map(events.map((e) => [e.id, e.sportId]));

  const cardEventActions = await db.eventAction.findMany({
    where: { actionType: { in: cardActions.map((c) => c.name) } },
    select: { id: true, eventId: true, actionType: true, cardPayment: { select: { id: true } } },
  });

  let created = 0;
  for (const ea of cardEventActions) {
    if (ea.cardPayment) continue;
    const sportId = sportByEvent.get(ea.eventId);
    const amount = cardTypeBySport.get(`${sportId}:${ea.actionType}`) ?? 0;
    await db.cardPayment.create({
      data: { eventActionId: ea.id, amount, status: 'PENDING' },
    });
    created++;
  }
  console.log(`Pagos PENDING creados: ${created}`);

  // ── Step 3: recalculate scores for events that have card actions ──
  // (cards used to add +1 to the score; recalc removes them retroactively)
  // Mirrors src/lib/event-scores.ts so it runs with plain node (no TS loader).
  const eventIdsWithCards = [...new Set(cardEventActions.map((ea) => ea.eventId))];
  for (const evId of eventIdsWithCards) {
    const ev = await db.event.findUnique({
      where: { id: evId },
      select: { id: true, teamAId: true, teamBId: true, sportId: true },
    });
    if (!ev) continue;
    const cardNames = cardActions
      .filter((c) => c.sportId === ev.sportId)
      .map((c) => c.name);
    const evActions = await db.eventAction.findMany({
      where: { eventId: evId, value: { gt: 0 } },
      include: { player: { select: { teamId: true } } },
    });
    let scoreA = 0;
    let scoreB = 0;
    for (const a of evActions) {
      if (cardNames.includes(a.actionType)) continue;
      const value = a.value || 1;
      if (!a.player) continue;
      if (a.actionType === 'OWN_GOAL') {
        if (a.player.teamId === ev.teamAId) scoreB += value;
        else if (a.player.teamId === ev.teamBId) scoreA += value;
      } else {
        if (a.player.teamId === ev.teamAId) scoreA += value;
        else if (a.player.teamId === ev.teamBId) scoreB += value;
      }
    }
    const before = await db.event.findUnique({
      where: { id: evId },
      select: { scoreA: true, scoreB: true },
    });
    if (before.scoreA !== scoreA || before.scoreB !== scoreB) {
      await db.event.update({ where: { id: evId }, data: { scoreA, scoreB } });
      console.log(`📊 Marcador corregido ${evId}: ${before.scoreA}-${before.scoreB} → ${scoreA}-${scoreB}`);
    }
  }
  console.log(`Marcadores revisados: ${eventIdsWithCards.length} eventos con tarjetas`);
  console.log('\n=== Backfill completo ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
