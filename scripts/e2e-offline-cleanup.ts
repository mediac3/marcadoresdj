/**
 * Cleanup for the browser E2E offline test — removes the seeded
 * user/teams/players/event (found by the e2e_offline_ prefix / id args).
 * Usage: npx tsx scripts/e2e-offline-cleanup.ts <username> <eventId>
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

try {
  const raw = readFileSync(join(process.cwd(), '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* env already set */ }

const prisma = new PrismaClient();
const [, , username, eventId] = process.argv;

async function main() {
  if (eventId) {
    const ev = await prisma.event.findUnique({ where: { id: eventId } });
    if (ev) {
      await prisma.event.delete({ where: { id: eventId } });
      await prisma.player.deleteMany({ where: { teamId: { in: [ev.teamAId, ev.teamBId] } } });
      await prisma.team.deleteMany({ where: { id: { in: [ev.teamAId, ev.teamBId] } } });
      console.log('evento/teams eliminados:', eventId);
    }
  }
  if (username) {
    await prisma.user.deleteMany({ where: { username } });
    console.log('usuario eliminado:', username);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
