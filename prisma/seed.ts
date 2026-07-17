import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding MarcadoresDJ...');

  // 1. Create admin user
  const hashedPassword = await bcrypt.hash('1038796568', 10);
  const admin = await prisma.user.upsert({
    where: { username: '1038796568' },
    update: {},
    create: {
      username: '1038796568',
      password: hashedPassword,
      role: 'ADMIN',
      name: 'Administrador',
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.username);

  // 2. Create Sports
  const futbol = await prisma.sport.upsert({
    where: { name: 'Fútbol' },
    update: {},
    create: { name: 'Fútbol', icon: '⚽', isActive: true },
  });

  const baloncesto = await prisma.sport.upsert({
    where: { name: 'Baloncesto' },
    update: {},
    create: { name: 'Baloncesto', icon: '🏀', isActive: true },
  });

  const microfutbol = await prisma.sport.upsert({
    where: { name: 'Microfútbol' },
    update: {},
    create: { name: 'Microfútbol', icon: '🟡', isActive: true },
  });

  console.log('✅ Sports created:', futbol.name, baloncesto.name, microfutbol.name);

  // 3. Create Sport Actions for Fútbol
  const futbolActions = [
    { name: 'GOAL', label: 'Gol', icon: '⚽', color: '#22c55e', sortOrder: 0, defaultValue: 1 },
    { name: 'YELLOW_CARD', label: 'Amarilla', icon: '🟨', color: '#eab308', sortOrder: 1 },
    { name: 'RED_CARD', label: 'Roja', icon: '🟥', color: '#ef4444', sortOrder: 2 },
    { name: 'SUBSTITUTION', label: 'Cambio', icon: '🔄', color: '#3b82f6', sortOrder: 3 },
    { name: 'CORNER', label: 'Córner', icon: '📐', color: '#a855f7', sortOrder: 4 },
    { name: 'FOUL', label: 'Falta', icon: '⚠️', color: '#f97316', sortOrder: 5 },
    { name: 'OFFSIDE', label: 'Fuera de Juego', icon: '🚩', color: '#64748b', sortOrder: 6 },
    { name: 'INJURY', label: 'Lesión', icon: '🚑', color: '#ec4899', sortOrder: 7 },
    { name: 'PENALTY_GOAL', label: 'Gol Penalti', icon: '🎯', color: '#22c55e', sortOrder: 8, defaultValue: 1 },
    { name: 'OWN_GOAL', label: 'Autogol', icon: '😔', color: '#dc2626', sortOrder: 9, defaultValue: 1 },
    { name: 'PENALTY_MISSED', label: 'Penalti Errado', icon: '❌', color: '#dc2626', sortOrder: 10, defaultValue: 0 },
    { name: 'FREE_KICK_GOAL', label: 'Gol Tiro Libre', icon: '🦶', color: '#22c55e', sortOrder: 11, defaultValue: 1 },
  ];

  for (const action of futbolActions) {
    await prisma.sportAction.upsert({
      where: { name_sportId: { name: action.name, sportId: futbol.id } },
      update: { defaultValue: (action as Record<string, unknown>).defaultValue as number ?? 1 },
      create: { ...action, sportId: futbol.id },
    });
  }

  // 4. Create Sport Actions for Baloncesto
  const baloncestoActions = [
    { name: 'FREE_THROW', label: 'Tiro Libre (1)', icon: '🎯', color: '#22c55e', sortOrder: 0, defaultValue: 1 },
    { name: 'TWO_POINTS', label: 'Canasta (2)', icon: '🏀', color: '#22c55e', sortOrder: 1, defaultValue: 2 },
    { name: 'THREE_POINTS', label: 'Triple (3)', icon: '🌟', color: '#f59e0b', sortOrder: 2, defaultValue: 3 },
    { name: 'REBOUND', label: 'Rebote', icon: '💪', color: '#3b82f6', sortOrder: 3 },
    { name: 'ASSIST', label: 'Asistencia', icon: '🤝', color: '#a855f7', sortOrder: 4 },
    { name: 'STEAL', label: 'Robo', icon: '🦹', color: '#06b6d4', sortOrder: 5 },
    { name: 'BLOCK', label: 'Bloqueo', icon: '🛡️', color: '#f97316', sortOrder: 6 },
    { name: 'TURNOVER', label: 'Pérdida', icon: '❌', color: '#ef4444', sortOrder: 7 },
    { name: 'FOUL_BASKETBALL', label: 'Falta', icon: '🟨', color: '#eab308', sortOrder: 8 },
    { name: 'TECHNICAL_FOUL', label: 'Falta Técnica', icon: '🟥', color: '#ef4444', sortOrder: 9 },
    { name: 'TIMEOUT', label: 'Tiempo Muerto', icon: '⏸️', color: '#64748b', sortOrder: 10 },
    { name: 'SUBSTITUTION_BASKETBALL', label: 'Cambio', icon: '🔄', color: '#3b82f6', sortOrder: 11 },
  ];

  for (const action of baloncestoActions) {
    await prisma.sportAction.upsert({
      where: { name_sportId: { name: action.name, sportId: baloncesto.id } },
      update: { defaultValue: (action as Record<string, unknown>).defaultValue as number ?? 1 },
      create: { ...action, sportId: baloncesto.id },
    });
  }

  // 5. Create Sport Actions for Microfútbol
  const microfutbolActions = [
    { name: 'FUTSAL_GOAL', label: 'Gol', icon: '⚽', color: '#22c55e', sortOrder: 0, defaultValue: 1 },
    { name: 'FUTSAL_YELLOW', label: 'Amarilla', icon: '🟨', color: '#eab308', sortOrder: 1 },
    { name: 'FUTSAL_BLUE', label: 'Azul (2 min)', icon: '🟦', color: '#3b82f6', sortOrder: 2 },
    { name: 'FUTSAL_RED', label: 'Roja', icon: '🟥', color: '#ef4444', sortOrder: 3 },
    { name: 'FUTSAL_SUB', label: 'Cambio', icon: '🔄', color: '#a855f7', sortOrder: 4 },
    { name: 'FUTSAL_FOUL', label: 'Falta', icon: '⚠️', color: '#f97316', sortOrder: 5 },
    { name: 'FUTSAL_TIMEOUT', label: 'Tiempo Muerto', icon: '⏸️', color: '#64748b', sortOrder: 6 },
    { name: 'FUTSAL_GOALKEEPER', label: 'Portero Gol', icon: '🧤', color: '#22c55e', sortOrder: 7, defaultValue: 1 },
  ];

  for (const action of microfutbolActions) {
    await prisma.sportAction.upsert({
      where: { name_sportId: { name: action.name, sportId: microfutbol.id } },
      update: { defaultValue: (action as Record<string, unknown>).defaultValue as number ?? 1 },
      create: { ...action, sportId: microfutbol.id },
    });
  }

  console.log('✅ All sport actions seeded');

  // 6. Seed Colombia locations
  const colombia = await prisma.country.upsert({
    where: { name: 'Colombia' },
    update: { code: 'CO' },
    create: { name: 'Colombia', code: 'CO' },
  });
  console.log('✅ Country created:', colombia.name);

  const colombiaDepts = [
    'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar',
    'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca',
    'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
    'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta',
    'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío',
    'Risaralda', 'San Andrés', 'Santander', 'Sucre', 'Tolima',
    'Valle del Cauca', 'Vaupés', 'Vichada', 'Bogotá D.C.',
  ];

  const mainCities: Record<string, string[]> = {
    'Antioquia': ['Medellín', 'Envigado', 'Bello', 'Itagüí', 'Rionegro'],
    'Atlántico': ['Barranquilla', 'Soledad', 'Malambo'],
    'Bolívar': ['Cartagena', 'Magangué'],
    'Boyacá': ['Tunja', 'Duitama', 'Sogamoso'],
    'Caldas': ['Manizales', 'La Dorada'],
    'Cundinamarca': ['Soacha', 'Facatativá', 'Zipaquirá', 'Chía', 'Fusagasugá'],
    'Bogotá D.C.': ['Bogotá'],
    'Huila': ['Neiva', 'Pitalito'],
    'La Guajira': ['Riohacha', 'Maicao'],
    'Magdalena': ['Santa Marta', 'Ciénaga'],
    'Meta': ['Villavicencio', 'Acacías'],
    'Nariño': ['Pasto', 'Tumaco'],
    'Norte de Santander': ['Cúcuta', 'Ocaña'],
    'Quindío': ['Armenia', 'Calarcá', 'Montenegro'],
    'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal'],
    'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta'],
    'Sucre': ['Sincelejo', 'Corozal'],
    'Tolima': ['Ibagué', 'Espinal', 'Melgar'],
    'Valle del Cauca': ['Cali', 'Buenaventura', 'Palmira', 'Tuluá', 'Buga', 'Cartago'],
    'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta'],
  };

  let deptCount = 0;
  let cityCount = 0;

  for (const deptName of colombiaDepts) {
    const dept = await prisma.department.upsert({
      where: { name_countryId: { name: deptName, countryId: colombia.id } },
      update: {},
      create: { name: deptName, countryId: colombia.id },
    });
    deptCount++;

    const cities = mainCities[deptName] || [deptName.replace(' D.C.', '')];
    for (const cityName of cities) {
      await prisma.city.upsert({
        where: { name_departmentId: { name: cityName, departmentId: dept.id } },
        update: {},
        create: { name: cityName, departmentId: dept.id },
      });
      cityCount++;
    }
  }

  console.log(`✅ Locations seeded: ${deptCount} departments, ${cityCount} cities`);
  console.log('🌱 Seeding complete!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });