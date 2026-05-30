# Multi-stage build para Next.js 16:
# - builder: instala deps + corre `next build`
# - runner: solo lo necesario para `next start` (sin toolchain de build)
#
# No usamos `output: 'standalone'` por ahora: `next start` con el node_modules
# completo funciona y es lo que ya probamos en dev. Migrar a standalone es una
# optimizacion (~70% menos size) para mas adelante si la imagen molesta.

# ---------- builder ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

# Las NEXT_PUBLIC_* se inlinean en el bundle JS durante `next build`, por eso
# las necesitamos como ARG en build time (no solo runtime). EasyPanel pasa los
# env vars del servicio como --build-arg automaticamente (ya vimos eso con el
# backend).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

# Build sin telemetria: desactiva el ping de Next a stats.vercel.com.
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build

# ---------- runner ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10 --activate

# Solo lo necesario para que `next start` levante: build artifacts en .next,
# assets estaticos en public, deps en node_modules, y el manifest en package.json.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Por defecto Next escucha en 3000 — Traefik en EasyPanel lo expone afuera.
EXPOSE 3000

CMD ["pnpm", "start"]
