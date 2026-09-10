/**
 * Integration test for the offline sync engine against a REAL dev server.
 *
 * Simulates a complete offline session (queue only — no server calls),
 * then replays the queue through the same pure engine the browser uses
 * (`src/lib/offline/sync-core.ts`) and verifies the resulting database
 * state via Prisma. Finally re-runs the replay to prove idempotency
 * (no duplicated actions/comments).
 *
 * Creates and cleans up ALL of its own data (user, sport, teams,
 * players, event) — never touches existing rows.
 *
 * Usage:
 *   1. npm run dev            (server on http://localhost:3000)
 *   2. npx tsx scripts/test-offline-sync.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { syncOps, type SyncFetcher } from '../src/lib/offline/sync-core';
import type { OfflineOp } from '../src/lib/offline/types';

/* ── Environment ──────────────────────────────────────────────────────────── */

// Load DATABASE_URL from .env (Prisma client doesn't auto-load it in scripts).
const envPath = join(process.cwd(), '.env');
try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* .env optional if env vars already set */
}

const BASE = process.env.TEST_BASE ?? 'http://localhost:3000';
const prisma = new PrismaClient();

/* ── Helpers ──────────────────────────────────────────────────────────────── */

let passed = 0;
function ok(condition: boolean, label: string) {
  assert.strictEqual(condition, true, label);
  passed++;
  console.log(`  ✅ ${label}`);
}

async function waitForServer(timeoutMs = 90_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/ping`);
      if (res.status === 204) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() - start > timeoutMs) throw new Error('Server did not start');
    await new Promise((r) => setTimeout(r, 1_500));
  }
}

function makeFetcher(token: string): SyncFetcher {
  return async (path, init) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

async function main() {
  console.log('⏳ Esperando servidor en', BASE, '…');
  await waitForServer();
  console.log('🟢 Servidor listo\n');

  const suffix = Date.now().toString(36);

  /* ── Seed: own test data only ── */
  console.log('🌱 Creando datos de prueba propios…');
  const passwordHash = await bcrypt.hash('test-offline-pass-123', 10);
  const user = await prisma.user.create({
    data: {
      username: `offlinetest_${suffix}`,
      password: passwordHash,
      role: 'ADMIN',
      name: 'Offline Sync Test',
      isActive: true,
    },
  });

  const sport = await prisma.sport.create({
    data: {
      name: `TestOffline ${suffix}`,
      icon: '🧪',
      isActive: true,
    },
  });
  const goalAction = await prisma.sportAction.create({
    data: { sportId: sport.id, name: 'GOL', label: 'Gol', icon: '⚽', color: '#22c55e', sortOrder: 1, defaultValue: 1 },
  });
  const cardAction = await prisma.sportAction.create({
    data: { sportId: sport.id, name: 'AMARILLA', label: 'Tarjeta Amarilla', icon: '🟨', color: '#eab308', sortOrder: 2, defaultValue: 1, isCard: true, cardAmount: 15000 },
  });

  const teamA = await prisma.team.create({
    data: { name: `Offline A ${suffix}`, shortName: 'OA', sportId: sport.id, gender: 'M', ageCategory: 'Senior', createdById: user.id },
  });
  const teamB = await prisma.team.create({
    data: { name: `Offline B ${suffix}`, shortName: 'OB', sportId: sport.id, gender: 'M', ageCategory: 'Senior', createdById: user.id },
  });
  const playerA1 = await prisma.player.create({
    data: { name: 'Jugador A1', number: 1, position: 'Delantero', teamId: teamA.id },
  });
  const playerA2 = await prisma.player.create({
    data: { name: 'Jugador A2', number: 2, position: 'Defensa', teamId: teamA.id },
  });
  const playerB1 = await prisma.player.create({
    data: { name: 'Jugador B1', number: 1, position: 'Delantero', teamId: teamB.id },
  });

  const event = await prisma.event.create({
    data: {
      name: `Evento Offline Test ${suffix}`,
      sportId: sport.id,
      teamAId: teamA.id,
      teamBId: teamB.id,
      status: 'SCHEDULED',
      isPublic: false,
      createdById: user.id,
    },
  });
  console.log('   evento:', event.id, '\n');

  try {
    /* ── Login ── */
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: 'test-offline-pass-123' }),
    });
    const loginData = (await loginRes.json()) as { success: boolean; token: string };
    ok(loginRes.ok && loginData.success && !!loginData.token, 'login del usuario de prueba');
    const fetcher = makeFetcher(loginData.token);

    /* ── Simulated OFFLINE session (queue only) ── */
    console.log('\n📴 Simulando sesión sin conexión (solo cola)…');
    const golA1: string = randomUUID();
    const golB1: string = randomUUID();
    const cardA2: string = randomUUID(); // will be undone (deleted) before sync
    const golA1b: string = randomUUID();
    const commentId: string = randomUUID();

    const ops: OfflineOp[] = [
      { seq: 1, eventId: event.id, createdAt: Date.now(), type: 'TIMER', elapsedSeconds: 65, half: '1' },
      { seq: 2, eventId: event.id, createdAt: Date.now(), type: 'START' },
      {
        seq: 3, eventId: event.id, createdAt: Date.now(), type: 'ACTION_CREATE',
        action: { id: golA1, playerId: playerA1.id, actionType: 'GOL', actionLabel: 'Gol', actionIcon: '⚽', actionColor: '#22c55e', value: 1, minute: 1, half: '1' },
      },
      {
        seq: 4, eventId: event.id, createdAt: Date.now(), type: 'ACTION_CREATE',
        action: { id: golB1, playerId: playerB1.id, actionType: 'GOL', actionLabel: 'Gol', actionIcon: '⚽', actionColor: '#22c55e', value: 1, minute: 2, half: '1' },
      },
      {
        seq: 5, eventId: event.id, createdAt: Date.now(), type: 'ACTION_CREATE',
        action: { id: cardA2, playerId: playerA2.id, actionType: 'AMARILLA', actionLabel: 'Tarjeta Amarilla', actionIcon: '🟨', actionColor: '#eab308', value: 1, minute: 2, half: '1' },
      },
      { seq: 6, eventId: event.id, createdAt: Date.now(), type: 'ACTION_DELETE', actionId: cardA2 }, // undo → compacted client-side
      { seq: 7, eventId: event.id, createdAt: Date.now(), type: 'PAUSE_TO', target: 'PAUSED' },
      { seq: 8, eventId: event.id, createdAt: Date.now(), type: 'TIMER', elapsedSeconds: 180, half: '2' },
      { seq: 9, eventId: event.id, createdAt: Date.now(), type: 'PAUSE_TO', target: 'LIVE' },
      {
        seq: 10, eventId: event.id, createdAt: Date.now(), type: 'ACTION_CREATE',
        action: { id: golA1b, playerId: playerA1.id, actionType: 'GOL', actionLabel: 'Gol', actionIcon: '⚽', actionColor: '#22c55e', value: 1, minute: 3, half: '2' },
      },
      { seq: 11, eventId: event.id, createdAt: Date.now(), type: 'COMMENT_CREATE', comment: { id: commentId, content: 'Comentario registrado sin conexión' } },
      { seq: 12, eventId: event.id, createdAt: Date.now(), type: 'TIMER', elapsedSeconds: 240, half: '2' },
      { seq: 13, eventId: event.id, createdAt: Date.now(), type: 'END' },
    ];
    console.log(`   ${ops.length} operaciones encoladas\n`);

    /* ── Sync pass 1 ── */
    console.log('🔄 Sincronizando (pase 1)…');
    const result1 = await syncOps(ops, fetcher);
    ok(result1.error === undefined, `sin error fatal (${result1.error ?? 'ok'})`);
    ok(result1.conflicts.length === 0, `sin conflictos (${result1.conflicts.map((c) => c.reason).join('; ') || 'ninguno'})`);
    ok(result1.doneSeqs.length === ops.length, `todas las ops aplicadas (${result1.doneSeqs.length}/${ops.length})`);

    /* ── Verify DB state ── */
    console.log('\n🔎 Verificando estado en base de datos…');
    const dbEvent = await prisma.event.findUnique({
      where: { id: event.id },
      include: {
        actions: true,
        comments: true,
      },
    });
    assert.ok(dbEvent, 'evento existe');

    ok(dbEvent.status === 'FINISHED', `estado FINISHED (${dbEvent.status})`);
    ok(dbEvent.elapsedSeconds === 240, `elapsedSeconds final = 240 (${dbEvent.elapsedSeconds})`);
    ok(dbEvent.currentHalf === '2', `currentHalf final = '2' (${dbEvent.currentHalf})`);
    ok(dbEvent.startedAt !== null, 'startedAt registrado');
    ok(dbEvent.endedAt !== null, 'endedAt registrado');

    ok(dbEvent.actions.length === 3, `3 acciones creadas (${dbEvent.actions.length})`);
    ok(dbEvent.actions.every((a) => [golA1, golB1, golA1b].includes(a.id)), 'ids de cliente usados como PK');
    ok(!dbEvent.actions.some((a) => a.id === cardA2), 'acción deshecha no presente');

    ok(dbEvent.scoreA === 2 && dbEvent.scoreB === 1, `marcador recalculado 2-1 (${dbEvent.scoreA}-${dbEvent.scoreB})`);

    const payments = await prisma.cardPayment.findMany({
      where: { eventAction: { eventId: event.id } },
    });
    ok(payments.length === 0, `sin pagos de tarjeta (la amarilla fue deshecha) (${payments.length})`);

    ok(dbEvent.comments.length === 1 && dbEvent.comments[0].id === commentId, 'comentario creado con id de cliente');
    ok(dbEvent.comments[0].userId === user.id, 'comentario atribuido al usuario correcto');

    /* ── Sync pass 2 (idempotency: same ops replayed) ── */
    console.log('\n🔁 Repitiendo sincronización con las MISMAS ops (idempotencia)…');
    const result2 = await syncOps(ops, fetcher);
    ok(result2.error === undefined, 'pase 2 sin error fatal');
    // The create+delete pair of the undone card can't be re-applied on a
    // finished event (the real client never queues both — compaction
    // cancels them), so exactly that one op is expected to conflict.
    ok(
      result2.conflicts.length === 1 && result2.conflicts[0].opType === 'ACTION_CREATE',
      `pase 2: único conflicto esperado = re-creación de la amarilla deshecha (${result2.conflicts.length})`,
    );

    const actionsAfter = await prisma.eventAction.count({ where: { eventId: event.id } });
    const commentsAfter = await prisma.comment.count({ where: { eventId: event.id } });
    ok(actionsAfter === 3, `sin acciones duplicadas (${actionsAfter})`);
    ok(commentsAfter === 1, `sin comentarios duplicados (${commentsAfter})`);

    /* ── Conflict path: action on a FINISHED event ── */
    console.log('\n⚠️  Probando ruta de conflicto (acción sobre evento finalizado)…');
    const lateOp: OfflineOp = {
      seq: 14, eventId: event.id, createdAt: Date.now(), type: 'ACTION_CREATE',
      action: { id: randomUUID(), playerId: playerA1.id, actionType: 'GOL', actionLabel: 'Gol', actionIcon: '⚽', actionColor: '#22c55e', value: 1, minute: 9, half: '2' },
    };
    const result3 = await syncOps([lateOp], fetcher);
    ok(result3.conflicts.length === 1, 'conflicto reportado (1)');
    ok(result3.error === undefined, 'el conflicto no aborta el pase');

    console.log(`\n🎉 TODAS LAS PRUEBAS PASARON (${passed} aserciones)`);
  } finally {
    /* ── Cleanup: remove ONLY our own test data ── */
    console.log('\n🧹 Limpiando datos de prueba…');
    await prisma.event.delete({ where: { id: event.id } }).catch(() => {});
    await prisma.player.deleteMany({ where: { id: { in: [playerA1.id, playerA2.id] } } });
    await prisma.player.deleteMany({ where: { teamId: teamB.id } });
    await prisma.team.deleteMany({ where: { id: { in: [teamA.id, teamB.id] } } });
    await prisma.sportAction.deleteMany({ where: { sportId: sport.id } });
    await prisma.sport.delete({ where: { id: sport.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    console.log('   listo');
  }
}

main()
  .catch((err) => {
    console.error('\n❌ FALLO:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
