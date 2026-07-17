# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — MarcadoresDJ
# Build multi-stage basado en las prácticas oficiales de Next.js 16 con
# output: "standalone". Genera una imagen mínima apta para producción.
#
# Build:    docker build -t marcadoresdj .
# Run:      docker run -p 3000:3000 -e JWT_SECRET=xxx marcadoresdj
# ─────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:26-slim AS deps
WORKDIR /app

# OpenSSL requerido por Prisma en imágenes slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copia solo manifiestos para cachear install
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Instala dependencias (npm ci usa lockfile determinista)
RUN npm ci --omit=optional && npx prisma generate

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM node:26-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables de build (Next.js las necesita en build time)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# BD temporal solo para build (no se usa en runtime)
ENV DATABASE_URL="file:/tmp/build.db"

# Build de Next.js
RUN npm run build

# Sincroniza schema en la BD de build (para que el standalone arranque sin errores)
RUN npx prisma db push --skip-generate || true

# ─── Stage 3: runner (imagen final mínima) ──────────────────────────────────
FROM node:26-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copia el standalone build (self-contained)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Crea directorio de BD con permisos correctos
RUN mkdir -p /app/db && chown -R nextjs:nodejs /app/db

# Directorio de uploads persistente
RUN mkdir -p /app/public/uploads/logos && chown -R nextjs:nodejs /app/public/uploads

# Variables de entorno por defecto (sobreescribir con -e o docker-compose)
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/db/custom.db"
ENV NEXT_TELEMETRY_DISABLED=1
# JWT_SECRET debe ser proporcionado en runtime: -e JWT_SECRET=xxx

# Healthcheck ligero
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/public/events').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER nextjs

EXPOSE 3000

# tini se encarga de señales (SIGTERM, etc.)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
