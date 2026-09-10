/**
 * Seed helper for the browser E2E offline test.
 * Creates a dedicated test user + a SCHEDULED event (reusing an existing
 * sport with configured actions) and prints credentials.
 * Cleanup: scripts/e2e-offline-cleanup.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

try {
  const raw = readFileSync(join(process.cwd(), '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env already set */ }

const prisma = new PrismaClient();
const PASS = 'e2e-offline-123';

async function main() {
  // Reuse an existing active sport that has actions configured.
  const sport = await prisma.sport.findFirst({
    where: { isActive: true, actions: { some: {} } },
    include: { actions: true },
  });
  if (!sport) throw new Error('No hay deportes activos con acciones — crea uno primero');

  const username = `e2e_offline_${Date.now().toString(36)}`;
  const user = await prisma.user.create({
    data: {
      username,
      password: await bcrypt.hash(PASS, 10),
      role: 'ADMIN',
      name: 'E2E Offline',
      isActive: true,
    },
  });

  const suffix = Date.now().toString(36);
  const teamA = await prisma.team.create({
    data: { name: `E2E Local ${suffix}`, shortName: 'LOC', sportId: sport.id, gender: 'M', ageCategory: 'Senior', createdById: user.id },
  });
  const teamB = await prisma.team.create({
    data: { name: `E2E Visita ${suffix}`, shortName: 'VIS', sportId: sport.id, gender: 'M', ageCategory: 'Senior', createdById: user.id },
  });
  await prisma.player.create({ data: { name: 'Delantero Local', number: 9, position: 'Delantero', teamId: teamA.id } });
  await prisma.player.create({ data: { name: 'Defensa Local', number: 4, position: 'Defensa', teamId: teamA.id } });
  await prisma.player.create({ data: { name: 'Delantero Visita', number: 10, position: 'Delantero', teamId: teamB.id } });

  const event = await prisma.event.create({
    data: {
      name: `E2E Offline ${suffix}`,
      sportId: sport.id,
      teamAId: teamA.id,
      teamBId: teamB.id,
      status: 'SCHEDULED',
      isPublic: false,
      createdById: user.id,
    },
  });

  console.log(JSON.stringify({
    username, password: PASS, eventId: event.id,
    sport: sport.name, eventLabel: `${teamA.name} vs ${teamB.name}`,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
