# AI_CONTEXT.md – MarcadoresDJ

> **Propósito:** Este archivo contiene toda la información necesaria para que un modelo de IA (z.ai, Claude, GPT, etc.) pueda continuar el desarrollo del proyecto sin depender del historial de conversación.  
> **Actualizar después de cada sesión de trabajo** (fecha + resumen de cambios).

---

## 1. Descripción del proyecto

**MarcadoresDJ** es una plataforma web para gestionar eventos deportivos en vivo con marcadores en tiempo real. Permite registrar acciones de juego (goles, tarjetas, cambios), controlar el tiempo, integrar streaming, administrar torneos con brackets y tabla de posiciones, publicar noticias y mostrar anuncios publicitarios.

**Público objetivo:** Organizadores de torneos, clubes deportivos, medios de comunicación y aficionados.

**Características principales:**
- Marcadores en directo con control de tiempo (inicio, pausa, medio tiempo, fin) y seguimiento de periodos.
- Acciones de juego configurables por deporte (fútbol, baloncesto, microfútbol, extensible).
- Streaming integrado (URL y clave de emisión).
- Torneos con fases, brackets y clasificación.
- Publicaciones (noticias/anuncios) con vigencia programada.
- Anuncios overlay con rotación y fingerprint de visitante.
- Roles de usuario: ADMIN, CREATOR, INITIATOR.
- Vista pública sin autenticación, favoritos en localStorage.
- Subida de logos (URL o archivo local, máx 2 MB, formatos PNG/JPG/GIF/WebP/SVG).
- Exportación a PDF de eventos y reportes.
- Internacionalización (next-intl) y tema oscuro/claro (next-themes).

---

## 2. Stack tecnológico

| Capa          | Tecnología                          | Versión / Notas                |
|---------------|-------------------------------------|--------------------------------|
| Framework     | Next.js                             | 16 (App Router)                |
| Lenguaje      | TypeScript                          | Estricto (`strict: true`)      |
| Estilos       | Tailwind CSS                        | Última versión                 |
| ORM           | Prisma                              | Cliente PostgreSQL             |
| Base de datos | PostgreSQL                          | (local o cloud)                |
| Autenticación | NextAuth.js                         | (a implementar si no está)     |
| i18n          | next-intl                           | Mensajes en `/messages`        |
| Tema          | next-themes                         | Modo oscuro/claro              |
| Iconos        | Lucide React (recomendado)          | —                              |
| Utilidades    | date-fns, zod                       | Para fechas y validación       |
| Testing       | Vitest + Testing Library (opcional) | —                              |

---

## 3. Estructura de carpetas (deseada)

---

## Registro de sesiones

### 2026-09-11 — Jugador del Partido (MVP) + Probabilidades 1X2 (Dixon-Coles)

**Nueva funcionalidad 1 — Jugador del Partido:** al abrir la tarjeta de un evento (panel expandido) se destaca el MVP calculado con rating determinista por eventos ponderados (estilo índices de rendimiento): anotación +value×10 (usa metadatos `SportAction.isCard` reales del deporte, no listas de nombres), autogol −value×10, tarjetas amarilla −2 / azul −1 / roja −6, bono +1.5 al anotador del equipo ganador/líder; desempates: más goles → menos tarjetas → gol más temprano → nombre. Devuelve MVP + podio (top 3) con rating 1–10 para display. Si nadie anotó, no se muestra (no inventa MVP).

**Nueva funcionalidad 2 — Botones Gana·Empata·Gana (1X2):** cada tarjeta de evento (SCHEDULED/LIVE/PAUSED, fuera de modo selección y colapsada) muestra 3 botones; al hacer clic el visitante "pronostica" (persistido en localStorage `marcadoresdj-picks`), la tarjeta se expande y el sistema analiza probabilidades con **Dixon-Coles (1997)**: Poisson bivariado con corrección τ (ρ=−0.10) para deportes con empate; modelo Normal de diferencia de tanteo para baloncesto/voleibol (sin empate). Fuerzas por Maher (1982) ataque/defensa con shrinkage bayesiano (k=6) hacia la media del deporte (prior por deporte), ponderación exponencial por recencia (half-life 180 días), historial = partidos FINISHED públicos del mismo deporte (≤15 por equipo). Eventos LIVE: λ residual × fracción de tiempo restante + marcador actual (ajuste Browniano σ∝√fracción en modelo Normal). El panel muestra barras de %, marcador esperado, forma V/E/D últimos 5, PJ/V/E/D, GF/GC, "Tu pronóstico", confianza (ALTA/MEDIA/BAJA) y nota de metodología.

**Cambios:**
- NEW `src/lib/mvp.ts` (puro, sin DB) y NEW `src/lib/prediction.ts` (puro; `sportSlug` normaliza "Fútbol de salón"→`futboldesalon` porque `normalizeSportKey` NO quita espacios — cuidado al reutilizar).
- EDIT `api/public/events/[id]/route.ts`: respuesta incluye `mvp` (campo aditivo; consulta SportAction para isCard).
- NEW `api/public/events/[id]/prediction/route.ts` (GET público, solo lectura; historial + aggregate del deporte → `predictMatch`).
- EDIT `components/public/public-view.tsx`: `OddsRow` (reutilizable), `MvpSection` (hero + PlayerPopover avatarSize nuevo prop + podio), `PredictionSection` (análisis completo), `EventCard` fila 1X2 (hermana del botón principal, HTML válido), estado en `PublicView` (caché de predicciones con TTL 60s live/5min, refs para evitar duplicados, picks en localStorage).
- NEW `.zscripts/test-mvp-prediccion.sh` (API, contra servidor dev) y `.zscripts/test-prediction-lib.mjs` (unitario, corre con `node --experimental-strip-types --import .zscripts/alias-register.mjs`; loader de alias `@/` incluido).

**Pruebas:** 25/25 unitarias de libs + 16/16 API (suma de probabilidades=1, rangos, MVP válido, 404s) + E2E navegador en http://localhost:3001 (ver NOTA) como visitante: botones con %, pick [pressed], análisis Dixon-Coles consistente con API (22/21/57), MVP correcto (desempate por bono ganador verificado), secciones ocultas en FINISHED, comentarios/resumen/torneos intactos, sin errores de consola. Typecheck y lint: 0 errores nuevos (36 preexistentes sin cambio).

**NOTA importante (E2E en local):** si se prueba el build de producción en el puerto 3000, el service worker (`public/sw.js`, cache-first en `/_next/static/*`) sirve chunks viejos y hace parecer que los cambios no aplican. Probar cambios de dev en otro puerto (p.ej. `npx next dev -p 3001`) o desregistrar el SW en DevTools.

### 2026-09-05 — Fix permisos Equipos para CREADOR/INICIADOR

**Problema:** con permisos de Equipos otorgados al rol CREADOR, la edición de equipos no funcionaba y no permitía crear/editar jugadores. Causa raíz: `requireTeamAccess` exigía ownership (`team.createdById === userId`) y todos los equipos existentes son legados/importados con `createdById = null`; además la UI (`team-detail-view`) calculaba `canEditTeam` solo por ownership, ignorando los flags del panel, y los endpoints de jugadores usaban checks de rol hardcodeados (ADMIN/CREATOR) al margen del módulo de permisos.

**Solución:** los flags de `RoleSectionPermission` (sección `teams`) son la única fuente de verdad para no-ADMIN:
- `event-auth.ts`: `requireTeamAccess` sin parámetro de equipo; ownership solo informativa.
- Endpoints de jugadores (`POST /api/teams/[id]/players`, `POST .../players/batch`, `PUT|DELETE /api/players/[id]`) ahora usan `requireTeamAccess` (crear/importar → canCreate; editar jugador → canEdit; eliminar → canDelete).
- `POST /api/teams/batch` asigna `createdById` al importador.
- `GET /api/admin/permissions` ahora exige ADMIN de verdad (antes ignoraba el resultado del check).
- `team-detail-view.tsx`: botones granulares vía `/api/my-permissions` (Editar equipo/jugador → canEdit; Agregar/Importar jugador → canCreate; Eliminar jugador → canDelete).
- `player-modal.tsx`: deduplicar sugerencias de posición (fix warning React claves duplicadas).

**Pruebas:** 18/18 tests de API (`bash .zscripts/test-permisos-equipos.sh`, requiere usuarios testadmin/testcreator/testinit) + E2E en navegador como CREADOR (crear y editar jugador en equipo legado). ADMIN sin cambios; INICIADOR sin permisos sigue recibiendo 403.

### 2026-09-05 (2) — Asignación de equipos por el ADMINISTRADOR

**Nueva funcionalidad:** el modal de edición de equipo incluye un select **"Creador Asignado"** visible solo para ADMIN (opciones: "Sin asignar (solo administrador)" + usuarios activos con rol CREATOR, desde `/api/auth/users`). Así el ADMIN controla qué equipos gestiona cada CREADOR.

**Modelo de acceso resultante (sección `teams`):**
- Ver/Crear equipos (y listar jugadores): solo requiere el flag del panel (`canView`/`canCreate`).
- Gestionar un equipo concreto (editarlo/eliminarlo, crear/importar/editar/eliminar sus jugadores): flag correspondiente **Y** que el equipo esté asignado al usuario (`createdById === userId`). Equipos sin asignar (`null`) → solo ADMIN.
- `PUT /api/teams/[id]` acepta `createdById` (id de usuario o null); **solo ADMIN** puede cambiarlo (403 si otro rol lo intenta; 400 si el usuario no existe o está inactivo).
- Un CREADOR que crea/importa un equipo queda como su asignado automáticamente.

**Cambios:** `event-auth.ts` (`requireTeamAccess` vuelve a aceptar el equipo y exige asignación para no-ADMIN), `api/teams/[id]` (PUT acepta createdById; PUT/DELETE pasan el equipo), `api/teams/[id]/players`(+batch) y `api/players/[id]` pasan el equipo para validar asignación, `team-detail-view.tsx` (select admin-only + botones = flags AND asignado; carga creadores vía `/api/auth/users`), `api/admin/permissions/route.ts` (consts sin export para el type-checker de Next).

**Pruebas:** 22/22 `.zscripts/test-asignacion-equipos.sh` (asignar/reasignar/desasignar, aislamiento entre dos creadores, creador no puede reasignar, validación de usuario inexistente) + 18/18 regresión de permisos + E2E navegador (ADMIN asigna vía select y persiste; CREADOR asignado ve botones y crea jugador; CREADOR sin asignación no ve botones ni el select).
