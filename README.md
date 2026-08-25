# ⚡ MarcadoresDJ

> Plataforma de marcadores deportivos en tiempo real construida con Next.js 16, TypeScript, Prisma y Tailwind CSS.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MarcadoresDJ permite gestionar eventos deportivos en vivo con marcadores en tiempo real, control de tiempo, acciones de juego (goles, tarjetas, cambios), streaming, torneos, publicaciones y anuncios. Cuenta con sistema de roles (ADMIN, CREATOR, INITIATOR) y una vista pública accesible sin autenticación.

---

## 📑 Tabla de contenidos

- [Características](#-características)
- [Stack tecnológico](#-stack-tecnológico)
- [Arquitectura del proyecto](#-arquitectura-del-proyecto)
- [Requisitos previos](#-requisitos-previos)
- [Instalación local](#-instalación-local)
- [Variables de entorno](#-variables-de-entorno)
- [Base de datos](#-base-de-datos)
- [Scripts disponibles](#-scripts-disponibles)
- [Despliegue en xcloud.host](#-despliegue-en-xcloudhost)
- [Despliegue con Docker](#-despliegue-con-docker)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Roles y permisos](#-roles-y-permisos)
- [API](#-api)
- [Contribuir](#-contribuir)
- [Licencia](#-licencia)

---

## ✨ Características

- **Marcadores en tiempo real** con control de tiempo (inicio, pausa, mitad, fin) y half/period tracking.
- **Acciones de juego configurables** por deporte: goles, tarjetas, cambios, canastas, triples, etc.
- **Streaming integrado**: soporte para URL de streaming y streaming key.
- **Multideporte**: Fútbol, Baloncesto, Microfútbol (extensible).
- **Torneos** con fases, brackets y tabla de posiciones.
- **Publicaciones** (noticias/anuncios) con vigencia configurable.
- **Anuncios publicitarios** overlay con rotación y fingerprint de visitante.
- **Roles de usuario**:
  - **ADMIN**: acceso total (gestión de usuarios, deportes, configuración global).
  - **CREATOR**: crea eventos, equipos, jugadores y torneos.
  - **INITIATOR**: anota acciones y controla tiempo solo en eventos asignados.
- **Vista pública** accesible sin login, con favoritos (localStorage), filtros por deporte y estado.
- **Subida de logos** desde URL o archivo local (PNG/JPG/GIF/WebP/SVG, máx 2MB).
- **Exportación a PDF** de eventos y reportes.
- **Internacionalización** con next-intl.
- **Tema oscuro/claro** con next-themes.

---

## 🛠️ Stack tecnológico

| Capa             | Tecnología                                           |
| ---------------- | ---------------------------------------------------- |
| Framework        | Next.js 16 (App Router, standalone output, Turbopack)|
| Lenguaje         | TypeScript 5                                         |
| UI               | React 19, Tailwind CSS 4, shadcn/ui, Radix UI        |
| Estado           | Zustand, TanStack Query                              |
| Formularios      | React Hook Form + Zod                                |
| Base de datos    | SQLite (dev) / PostgreSQL recomendado (prod)         |
| ORM              | Prisma 6                                             |
| Auth             | JWT (jose) — propio, sin NextAuth activo             |
| Icons            | lucide-react                                         |
| PDF              | jsPDF + jsPDF-AutoTable                              |
| Charts           | Recharts                                             |
| Runtime          | Bun (recomendado) o Node.js 20+                      |

---

## 🏗️ Arquitectura del proyecto

```
MarcadoresDJ
├── src/
│   ├── app/                 # App Router (páginas + API routes)
│   │   ├── api/             # REST API organizada por recurso
│   │   │   ├── auth/        # login, me, users, change-password
│   │   │   ├── events/      # CRUD de eventos + acciones/timer/scores
│   │   │   ├── public/      # endpoints públicos (sin auth)
│   │   │   ├── sports/      # deportes + acciones
│   │   │   ├── teams/       # equipos + jugadores
│   │   │   ├── tournaments/ # torneos + fases
│   │   │   ├── publications/# noticias/anuncios
│   │   │   ├── ads/         # anuncios overlay
│   │   │   ├── analytics/   # métricas
│   │   │   ├── admin/       # endpoints de administración
│   │   │   ├── locations/   # países, departamentos, ciudades
│   │   │   ├── event-access/# permisos de INITIATOR por evento
│   │   │   ├── my-events/   # eventos del usuario actual
│   │   │   ├── my-permissions/# permisos del usuario actual
│   │   │   ├── players/     # jugadores
│   │   │   └── upload/      # subida de archivos
│   │   ├── layout.tsx       # layout raíz
│   │   ├── page.tsx         # vista pública (homepage)
│   │   └── globals.css      # estilos globales Tailwind
│   ├── components/          # componentes React
│   │   ├── admin/           # panel admin
│   │   ├── public/          # vista pública + ad-overlay
│   │   └── ui/              # shadcn/ui primitives
│   ├── hooks/               # hooks custom (favorites, etc.)
│   └── lib/                 # utilidades, auth, db, api client
├── prisma/
│   ├── schema.prisma        # esquema de la BD
│   └── seed.ts              # datos iniciales (admin + deportes)
├── public/                  # assets estáticos + uploads
├── .zscripts/               # scripts oficiales de build/dev/start (z.ai/xcloud)
├── db/                      # SQLite local (ignorado)
├── Caddyfile                # configuración de reverse proxy (producción)
├── Dockerfile               # imagen Docker multi-stage
└── docker-compose.yml       # orquestación local
```

---

## ✅ Requisitos previos

- **Bun** >= 1.3 (recomendado) — [instalación](https://bun.sh/docs/installation)
  - Alternativa: Node.js >= 20 y npm
- **SQLite** (incluido en el sistema operativo, no requiere instalación)
- Para producción: **PostgreSQL** >= 14 (recomendado) o continuar con SQLite

---

## 🚀 Instalación local

```bash
# 1. Clonar el repositorio
git clone https://github.com/mediac3/marcadoresdj.git
cd marcadoresdj

# 2. Instalar dependencias
bun install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus valores (especialmente JWT_SECRET en producción)

# 4. Inicializar la base de datos
bun run db:generate     # Genera el Prisma Client
bun run db:push         # Crea las tablas en SQLite

# 5. (Opcional) Sembrar datos iniciales: admin + deportes + acciones
bunx prisma db seed

# 6. Iniciar servidor de desarrollo
bun run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Credenciales por defecto (tras el seed)

| Campo    | Valor                            |
| -------- | -------------------------------- |
| Usuario  | `admin`                          |
| Password | `admin-password-change-me`       |
| Rol      | `ADMIN`                          |

> ⚠️ **Cambia estas credenciales inmediatamente en producción** configurando las variables de entorno `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` y `SEED_ADMIN_NAME` antes de ejecutar el seed, o creando un nuevo admin y eliminando el usuario por defecto desde el panel.

---

## 🔐 Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

```bash
cp .env.example .env
```

| Variable                 | Descripción                                   | Default (dev)                              |
| ------------------------ | --------------------------------------------- | ------------------------------------------ |
| `DATABASE_URL`           | URL de conexión a la BD (SQLite o PostgreSQL) | `file:/home/z/my-project/db/custom.db`     |
| `JWT_SECRET`             | Secreto para firmar tokens JWT (>= 32 chars)  | dev-only (NO usar en producción)           |
| `NODE_ENV`               | `development` o `production`                  | `development`                              |
| `PORT`                   | Puerto del servidor (solo producción)         | `3000`                                     |
| `HOSTNAME`               | Host bind (producción)                        | `0.0.0.0`                                  |
| `NEXT_TELEMETRY_DISABLED`| Desactiva telemetría de Next.js               | `1`                                        |

Genera un JWT_SECRET seguro con:

```bash
openssl rand -base64 48
```

---

## 🗄️ Base de datos

### Desarrollo (SQLite)

SQLite ya está configurado por defecto. La BD se crea en `db/custom.db`. Este archivo se versiona en Git **intencionalmente** como snapshot de referencia que sirve de BD inicial en nuevos despliegues; en producción la BD viva se mantiene aparte y nunca se sobrescribe (ver «Producción: preservación de datos» más abajo).

```bash
bun run db:push      # Aplica el schema a la BD
bun run db:generate  # Regenera el Prisma Client
bunx prisma studio   # GUI para inspeccionar la BD en http://localhost:5555
```

### Producción (recomendado: PostgreSQL)

1. Edita `prisma/schema.prisma` y cambia el provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Configura `DATABASE_URL` en tu entorno:
   ```
   DATABASE_URL="postgresql://user:pass@host:5432/marcadoresdj?schema=public"
   ```
3. Ejecuta migración:
   ```bash
   bunx prisma migrate deploy
   bunx prisma db seed
   ```

### Seed

El seed (`prisma/seed.ts`) crea:

- Usuario admin (credenciales configurables via env vars, ver abajo)
- Deportes: Fútbol, Baloncesto, Microfútbol
- Acciones por deporte (Gol, Amarilla, Roja, Cambio, Canasta, Triple, etc.)

Para personalizar las credenciales del admin en el seed:

```bash
SEED_ADMIN_USERNAME="mi-admin" \
SEED_ADMIN_PASSWORD="password-seguro-aqui" \
SEED_ADMIN_NAME="Mi Nombre" \
bunx prisma db seed
```

### Producción: preservación de datos

> **Regla de oro:** los despliegues JAMÁS sobrescriben la BD de producción. El
> `db/custom.db` del repositorio es solo un snapshot de referencia (bootstrap
> para instalaciones nuevas); la BD viva de producción vive fuera del paquete
> desplegable.

**Cómo funciona en cada plataforma:**

| Plataforma | Dónde vive la BD de producción | Por qué los datos están a salvo |
| ---------- | ------------------------------ | ------------------------------- |
| **xcloud** (`.zscripts/`) | `/app/data/custom.db` | Está fuera del paquete de despliegue. `start.sh` la adopta solo en el primer arranque; en los siguientes la conserva intacta, hace un backup automático (mantiene los 5 más recientes en `/app/data/backups/`) y sincroniza tablas/columnas nuevas con `prisma db push` (no destructivo). |
| **Docker / Compose** | Volumen `marcadoresdj_db` (`/app/db`) | `.dockerignore` excluye la BD de la imagen, y el volumen persiste entre reinicios y redeploys (`docker compose up --build` no lo toca). |
| **BD externa** (PostgreSQL u otra) | La que indique `DATABASE_URL` | El despliegue nunca escribe en ella; solo `prisma db push`/`migrate` aplican cambios de esquema. |

**Migración de una instalación xcloud existente (solo una vez):** los
despliegues antiguos usaban la BD empaquetada directamente en
`/app/db/custom.db`. Antes del primer despliegue con la nueva lógica, ejecuta
en la instancia de producción para que `start.sh` adopte la BD viva actual:

```bash
mkdir -p /app/data
cp /app/db/custom.db /app/data/custom.db
```

**Backups manuales:**

```bash
# xcloud (en la instancia): la BD viva + los backups automáticos
cp /app/data/custom.db /tmp/backup-$(date +%Y%m%d).db

# Docker Compose
docker compose cp marcadoresdj:/app/db/custom.db ./backup-$(date +%Y%m%d).db
```

**Restaurar** es copiar el backup de vuelta a la ruta correspondiente
(`/app/data/custom.db` en xcloud; el volumen en Docker) con los servicios
detenidos, y arrancar de nuevo.

---

## 📜 Scripts disponibles

| Script              | Descripción                                              |
| ------------------- | -------------------------------------------------------- |
| `bun run dev`       | Servidor de desarrollo (Turbopack) en `:3000`            |
| `bun run build`     | Build de producción (`output: standalone`)               |
| `bun run start`     | Sirve el build standalone en producción                  |
| `bun run lint`      | ESLint                                                   |
| `bun run db:push`   | Sincroniza `schema.prisma` con la BD                     |
| `bun run db:generate`| Regenera el Prisma Client                               |
| `bun run db:migrate`| Crea y aplica migración (desarrollo)                     |
| `bun run db:reset`  | Reset total de la BD (¡borra datos!)                     |

---

## ☁️ Despliegue en xcloud.host

El repositorio incluye los scripts oficiales de despliegue en `.zscripts/` (compatibles con plataformas z.ai/xcloud):

| Script                          | Acción                                                     |
| ------------------------------- | ---------------------------------------------------------- |
| `.zscripts/dev.sh`              | Entorno de desarrollo completo (BD + dev server + mini-services) |
| `.zscripts/build.sh`            | Build de producción: dependencias + Next.js build + mini-services + empaquetado en tar.gz |
| `.zscripts/start.sh`            | Arranca producción: Next.js standalone + mini-services + Caddy |

### Flujo típico en xcloud

1. Clona el repo en tu instancia xcloud.host.
2. Ejecuta el build:
   ```bash
   BUILD_ID=$(date +%s) bash .zscripts/build.sh
   ```
   Esto genera `/tmp/build_fullstack_<id>.tar.gz` con todo lo necesario.
3. Despliega el tar.gz según el proceso de tu plataforma.
4. El `start.sh` es el entrypoint: arranca Next.js + Caddy (puerto 81 por defecto, ver `Caddyfile`).

### Variables de entorno en producción

Configura en tu panel de xcloud.host:

```
JWT_SECRET=<genera-uno-aleatorio-fuerte>
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
NEXT_TELEMETRY_DISABLED=1
```

> **`DATABASE_URL` ya no hace falta configurarla** (legacy: `file:/app/db/custom.db`).
> `start.sh` gestiona la BD automáticamente en `/app/data/custom.db`, que
> persiste entre despliegues (ver «Producción: preservación de datos»). Solo
> define `DATABASE_URL` si usas una BD externa como PostgreSQL; en ese caso
> cambia también el provider en `prisma/schema.prisma` antes del build.

---

## 🐳 Despliegue con Docker

```bash
# Build de la imagen
docker build -t marcadoresdj .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL="file:/app/db/custom.db" \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  -e NODE_ENV=production \
  -v marcadoresdj_db:/app/db \
  marcadoresdj
```

O con Docker Compose:

```bash
docker compose up -d
```

La imagen expone el puerto **3000**. El volumen `marcadoresdj_db` persiste la base de datos SQLite.

---

## 🧩 Estructura del proyecto

Ver la sección [Arquitectura del proyecto](#-arquitectura-del-proyecto) más arriba. Puntos clave:

- **API REST** bajo `/api/*` con autenticación JWT Bearer.
- **Endpoints públicos** bajo `/api/public/*` (sin auth, para la vista pública).
- **Prisma Client singleton** en `src/lib/db.ts` (evita múltiples conexiones en dev).
- **Auth helpers** en `src/lib/auth.ts` (sign/verify JWT, extract Bearer token).
- **Event scores y timer logic** en `src/lib/event-scores.ts` y `src/lib/global-timer.ts`.

---

## 👥 Roles y permisos

| Rol        | Permisos                                                              |
| ---------- | -------------------------------------------------------------------- |
| `ADMIN`    | Todo: usuarios, deportes, acciones, equipos, eventos, torneos, etc.  |
| `CREATOR`  | Crear/editar sus propios eventos, equipos, jugadores, publicaciones. |
| `INITIATOR`| Anotar acciones y controlar timer en eventos donde tenga acceso.     |

La asignación de INITIATOR a eventos específicos se gestiona mediante `EventAccess` (ver `/api/event-access`).

---

## 🔌 API

### Autenticación

Todos los endpoints no públicos requieren header:

```
Authorization: Bearer <token>
```

El token se obtiene con `POST /api/auth/login`.

### Endpoints principales

| Método | Ruta                                  | Descripción                          | Auth |
| ------ | ------------------------------------- | ------------------------------------ | ---- |
| POST   | `/api/auth/login`                     | Login (devuelve JWT)                 | ❌   |
| GET    | `/api/auth/me`                        | Usuario actual                       | ✅   |
| GET    | `/api/public/events`                  | Eventos públicos                     | ❌   |
| GET    | `/api/public/events/[id]`             | Detalle de evento público            | ❌   |
| GET    | `/api/public/tournaments`             | Torneos públicos                     | ❌   |
| GET    | `/api/sports`                         | Listar deportes                      | ✅   |
| POST   | `/api/sports`                         | Crear deporte                        | ADMIN|
| GET    | `/api/teams`                          | Listar equipos                       | ✅   |
| POST   | `/api/teams`                          | Crear equipo                         | CREATOR+|
| GET    | `/api/events`                         | Listar eventos                       | ✅   |
| POST   | `/api/events`                         | Crear evento                         | CREATOR+|
| POST   | `/api/events/[id]/actions`            | Registrar acción de juego            | INITIATOR+|
| POST   | `/api/events/[id]/start`              | Iniciar evento                       | INITIATOR+|
| POST   | `/api/events/[id]/pause`              | Pausar evento                        | INITIATOR+|
| POST   | `/api/events/[id]/end`                | Finalizar evento                     | INITIATOR+|
| POST   | `/api/events/[id]/timer`              | Actualizar timer                     | INITIATOR+|
| GET    | `/api/tournaments`                    | Listar torneos                       | ✅   |
| POST   | `/api/tournaments`                    | Crear torneo                         | CREATOR+|
| GET    | `/api/publications/active`            | Publicaciones activas                | ❌   |
| POST   | `/api/upload`                         | Subir logo (PNG/JPG/GIF/WebP/SVG)    | ✅   |

> La lista completa de endpoints está en `src/app/api/`.

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor:

1. Lee el [Código de Conducta](CODE_OF_CONDUCT.md) (si está presente).
2. Abre un issue primero para discutir cambios grandes.
3. Sigue la plantilla de [Pull Request](.github/PULL_REQUEST_TEMPLATE.md).
4. Asegúrate de que `bun run lint` y `bun run build` pasen sin errores.

```bash
# Flujo típico
git checkout -b feature/mi-feature
# ... cambios ...
bun run lint
bun run build
git commit -m "feat: agrega mi-feature"
git push origin feature/mi-feature
# Abre PR en GitHub
```

### Convención de commits (recomendada)

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `docs:` solo documentación
- `style:` formato (no afecta lógica)
- `refactor:` refactor sin cambio de comportamiento
- `perf:` mejora de rendimiento
- `test:` agrega o corrige tests
- `chore:` tareas de mantenimiento

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT — ver [LICENSE](LICENSE).

---

## 🙏 Créditos

Desarrollado con Next.js, Prisma, Tailwind CSS y shadcn/ui.

- **Next.js**: <https://nextjs.org>
- **Prisma**: <https://www.prisma.io>
- **shadcn/ui**: <https://ui.shadcn.com>
- **Tailwind CSS**: <https://tailwindcss.com>
