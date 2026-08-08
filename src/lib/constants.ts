// ── Half labels per sport ─────────────────────────────────────────────────────

export const SPORT_HALVES: Record<string, string[]> = {
  futbol: ['1', '2'],
  baloncesto: ['1Q', '2Q', '3Q', '4Q'],
  microfutbol: ['1', '2'],
  voleibol: ['S1', 'S2', 'S3', 'S4', 'S5'],
  beisbol: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  handball: ['1', '2'],
};

// ── Position options per sport ───────────────────────────────────────────────

export const SPORT_POSITIONS: Record<string, string[]> = {
  futbol: [
    'Portero',
    'Defensa Central',
    'Lateral Derecho',
    'Lateral Izquierdo',
    'Mediocentro Defensivo',
    'Mediocentro',
    'Mediapunta',
    'Extremo Derecho',
    'Extremo Izquierdo',
    'Delantero Centro',
    'Segundo Delantero',
  ],
  baloncesto: [
    'Base (PG)',
    'Escolta (SG)',
    'Alero (SF)',
    'Ala-Pivot (PF)',
    'Pivot (C)',
  ],
  microfutbol: [
    'Portero',
    'Cierre',
    'Ala',
    'Pivot',
  ],
  voleibol: [
    'Colocador',
    'Opuesto',
    'Central',
    'Receptor',
    'Libero',
  ],
  beisbol: [
    'Receptor',
    'Primera Base',
    'Segunda Base',
    'Tercera Base',
    'Campo Corto',
    'Jardinero Izquierdo',
    'Jardinero Central',
    'Jardinero Derecho',
    'Lanzador',
  ],
  handball: [
    'Portero',
    'Pivote',
    'Lateral Izquierdo',
    'Lateral Derecho',
    'Central',
    'Extremo Izquierdo',
    'Extremo Derecho',
  ],
};

// ── Goal / point-scoring action types ────────────────────────────────────────
// These action names are used to determine which actions count towards the
// scoreboard (scoreA / scoreB) for each sport.
//
// IMPORTANT: values must match the `SportAction.name` that gets stored verbatim
// in `EventAction.actionType` (see prisma/seed.ts and scoring-view.tsx). The
// backend scoreboard (event-scores.ts) actually keys off `value > 0`, but the
// public view uses this map to decide which actions render as "goals" in the
// match summary, so the names here MUST be the real seeded names (uppercase).
//
// Keys are sport names normalised to ASCII lowercase (accents stripped) since
// the public view only has the human sport name ("Fútbol") available.

export const GOAL_ACTION_TYPES: Record<string, string[]> = {
  futbol: ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'FREE_KICK_GOAL'],
  microfutbol: ['FUTSAL_GOAL', 'FUTSAL_GOALKEEPER'],
  baloncesto: ['FREE_THROW', 'TWO_POINTS', 'THREE_POINTS'],
  handball: ['GOAL'],
  voleibol: ['POINT'],
  beisbol: ['RUN'],
};

/**
 * Action types that represent an own goal (the point counts for the opposite
 * team). Mirrors the literal the backend uses in event-scores.ts.
 */
export const OWN_GOAL_ACTION_TYPES = new Set(['OWN_GOAL']);

/**
 * Check whether a given action type contributes to the score in a sport.
 * Accepts either a sport id or the human sport name (accents are stripped).
 */
export function isScoringAction(
  sportKey: string,
  actionType: string,
): boolean {
  const key = normalizeSportKey(sportKey);
  const types = GOAL_ACTION_TYPES[key];
  if (types) return types.includes(actionType);
  return false;
}

/**
 * Normalise a sport id or human name ("Fútbol", "Microfútbol") to the ASCII
 * lowercase key used in GOAL_ACTION_TYPES ("futbol", "microfutbol").
 */
export function normalizeSportKey(sport: string): string {
  return sport
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // strip diacritics
}

// ── Event status labels ──────────────────────────────────────────────────────

export const EVENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado',
  LIVE: 'En vivo',
  PAUSED: 'Pausado',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

// ── Match duration defaults (in seconds) ─────────────────────────────────────

export const MATCH_DURATIONS: Record<string, number> = {
  futbol: 5400, // 90 min
  microfutbol: 2400, // 40 min
  baloncesto: 2400, // 40 min (4 × 10)
  handball: 3600, // 60 min (2 × 30)
  voleibol: 0, // No fixed duration
  beisbol: 0, // No fixed duration
};

// ── Gender options ─────────────────────────────────────────────────────────────

export const GENDER_OPTIONS = [
  { value: 'Masculino', label: 'Masculino' },
  { value: 'Femenino', label: 'Femenino' },
  { value: 'Mixto', label: 'Mixto' },
];

// ── Age category options ──────────────────────────────────────────────────────

export const AGE_CATEGORY_OPTIONS = [
  { value: 'Sub-13', label: 'Sub-13' },
  { value: 'Sub-15', label: 'Sub-15' },
  { value: 'Sub-17', label: 'Sub-17' },
  { value: 'Juvenil', label: 'Juvenil' },
  { value: 'Junior', label: 'Junior' },
  { value: 'Sub-20', label: 'Sub-20' },
  { value: 'Sub-23', label: 'Sub-23' },
  { value: 'Senior', label: 'Senior' },
  { value: 'Libre', label: 'Libre' },
];

// ── Tournament phase options ──────────────────────────────────────────────────

export const TOURNAMENT_PHASES = [
  { value: 'Eliminatoria', label: 'Eliminatoria' },
  { value: 'Dieciseisavos de Final', label: 'Dieciseisavos de Final' },
  { value: 'Octavos de Final', label: 'Octavos de Final' },
  { value: 'Cuartos de Final', label: 'Cuartos de Final' },
  { value: 'Semifinal', label: 'Semifinal' },
  { value: 'Final', label: 'Final' },
  { value: 'Tercer Puesto', label: 'Tercer Puesto' },
  { value: 'Fase de Grupos - Grupo A', label: 'Fase de Grupos - Grupo A' },
  { value: 'Fase de Grupos - Grupo B', label: 'Fase de Grupos - Grupo B' },
  { value: 'Fase de Grupos - Grupo C', label: 'Fase de Grupos - Grupo C' },
  { value: 'Fase de Grupos - Grupo D', label: 'Fase de Grupos - Grupo D' },
];

// ── Phase order mapping (lower = earlier stage) ───────────────────────────────

export const PHASE_ORDER: Record<string, number> = {
  'Eliminatoria': 10,
  'Fase de Grupos - Grupo A': 20,
  'Fase de Grupos - Grupo B': 20,
  'Fase de Grupos - Grupo C': 20,
  'Fase de Grupos - Grupo D': 20,
  'Dieciseisavos de Final': 30,
  'Octavos de Final': 40,
  'Cuartos de Final': 50,
  'Semifinal': 60,
  'Tercer Puesto': 70,
  'Final': 80,
};

