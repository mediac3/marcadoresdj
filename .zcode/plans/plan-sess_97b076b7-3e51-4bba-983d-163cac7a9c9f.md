## Plan: Nueva Tab "Goleadores/Anotadores" en Torneos

### 1. Nuevo endpoint API: `src/app/api/public/tournaments/[id]/scorers/route.ts`

**GET `/api/public/tournaments/[id]/scorers`** — Público, sin autenticación.

**Lógica:**
- Consultar el torneo con: `phases -> events (where: isPublic, status in [FINISHED, LIVE, PAUSED]) -> actions -> player (include team) -> event.teamA/teamB`
- Para cada acción, verificar si es una acción de anotación usando el `SportAction` del evento (checking `defaultValue > 0` or the sport's scoring action names). Excluir `OWN_GOAL` / autogoles.
- Determinar qué acción types son de anotación por deporte mapeando los nombres reales de DB (e.g., `GOAL`, `PENALTY_GOAL` para fútbol; `FREE_THROW`, `TWO_POINTS`, `THREE_POINTS` para baloncesto; etc.)
- Agrupar por jugador: sumar goles/puntos, calcular equipo, desglose por tipo de acción
- Ordenar por total descendente
- Retornar: `{ success: true, scorers: [...], tabLabel: "Goleadores" | "Anotadores" | "Carreras", sport: "..." }`

**Cada scorer incluye:** `playerId`, `playerName`, `playerNumber`, `playerPhoto`, `teamId`, `teamName`, `teamShortName`, `teamLogo`, `total`, `goalsDetail` (desglose: ej. 3 goles, 1 penalti), `matchesPlayed` (partidos en los que anotó)

### 2. Modificar `src/components/public/public-view.tsx`

**Cambios en `TournamentSection`:**
- Añadir `'scorers'` al tipo de `activeView`: `useState<'matches' | 'standings' | 'bracket' | 'scorers'>('matches')`
- Añadir estado: `scorers`, `scorersLoading`, `scorersTabLabel`
- Añadir `useEffect` que fetch `/api/public/tournaments/${tournamentId}/scorers` cuando `tournamentId` existe
- Añadir botón de tab "Goleadores" (o el label dinámico del deporte) con icono `Target` de lucide-react
- La tab siempre se muestra (visible para cualquier tipo de torneo con deporte)

**Nuevo componente `ScorersTable`:**
- Tabla con columnas: `#`, `Jugador` (foto + nombre + número), `Equipo` (logo + nombre), `Partidos`, tipo de gol/punto columnas adaptadas por deporte, `Total`
- Estilo visual consistente con `StandingsTable` existente:
  - Fondo de la tabla con bordes `var(--border-custom)`
  - Header con `var(--bg-secondary)` y texto `var(--text-muted)`
  - Top 3 con highlight sutil
  - Total en color accent con font-extrabold
  - Medalla visual (🥇🥈🥉) para los 3 primeros
- Fallback: "No hay datos de goleadores aún" si está vacío

**Adaptación por deporte del label de la tab:**
- fútbol, microfútbol, handball → "Goleadores"
- baloncesto, voleibol → "Anotadores" 
- béisbol → "Carreras"
- Otro → "Anotadores"

### 3. Archivos a crear/modificar (solo 2)

| Archivo | Acción |
|---------|--------|
| `src/app/api/public/tournaments/[id]/scorers/route.ts` | **CREAR** — Nuevo endpoint |
| `src/components/public/public-view.tsx` | **MODIFICAR** — Añadir tab, estado, fetch, y componente ScorersTable |

**No se modifican:** schema.prisma, seed.ts, rutas existentes, componentes existentes de scoring/standings, ni ningún otro archivo.