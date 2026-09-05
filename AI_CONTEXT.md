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
