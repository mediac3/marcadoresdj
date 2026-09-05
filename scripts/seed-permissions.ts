/**
 * Seed script: create test users + default permissions.
 * Run: npx tsx scripts/seed-permissions.ts
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('=== Seeding Permissions Module ===\n');

  // 1. Create Initiator user
  const initiatorPw = await bcrypt.hash('1155218177', 10);
  const initiator = await db.user.upsert({
    where: { username: '1155218177' },
    update: {},
    create: {
      username: '1155218177',
      password: initiatorPw,
      name: 'Iniciador de Prueba',
      role: 'INITIATOR',
    },
  });
  console.log(`✅ Initiator user: ${initiator.username} (${initiator.role})`);

  // 2. Create Creator user
  const creatorPw = await bcrypt.hash('1040360867', 10);
  const creator = await db.user.upsert({
    where: { username: '1040360867' },
    update: {},
    create: {
      username: '1040360867',
      password: creatorPw,
      name: 'Creador de Prueba',
      role: 'CREATOR',
    },
  });
  console.log(`✅ Creator user: ${creator.username} (${creator.role})`);

  // 3. Seed default permissions
  // CREATOR: full access to events, teams, publications, ads
  const creatorPerms = [
    { role: 'CREATOR', section: 'events', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { role: 'CREATOR', section: 'teams', canView: true, canCreate: true, canEdit: true, canDelete: false },
    { role: 'CREATOR', section: 'publications', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { role: 'CREATOR', section: 'ads', canView: true, canCreate: true, canEdit: true, canDelete: true },
    { role: 'CREATOR', section: 'analytics', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { role: 'CREATOR', section: 'sports', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { role: 'CREATOR', section: 'locations', canView: true, canCreate: false, canEdit: false, canDelete: false },
    { role: 'CREATOR', section: 'payments', canView: true, canCreate: false, canEdit: true, canDelete: false },
  ];

  // INITIATOR: view events only, scoring via EventAccess
  const initiatorPerms = [
    { role: 'INITIATOR', section: 'events', canView: true, canCreate: false, canEdit: false, canDelete: false },
  ];

  const allPerms = [...creatorPerms, ...initiatorPerms];

  for (const perm of allPerms) {
    await db.roleSectionPermission.upsert({
      where: { role_section: { role: perm.role, section: perm.section } },
      update: {
        canView: perm.canView,
        canCreate: perm.canCreate,
        canEdit: perm.canEdit,
        canDelete: perm.canDelete,
      },
      create: perm,
    });
    console.log(`  ✅ ${perm.role} → ${perm.section}: V=${perm.canView} C=${perm.canCreate} E=${perm.canEdit} D=${perm.canDelete}`);
  }

  console.log('\n=== Seed Complete ===');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());