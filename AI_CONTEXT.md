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
