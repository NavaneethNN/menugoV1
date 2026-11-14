# ==============================================================================
# MenuGo Web Frontend Production Dockerfile (Next.js Multi-Stage Build)
# ==============================================================================

# --- Stage 1: Build & Static Asset Generation ---
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy package manifests across monorepo
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/database/package*.json ./packages/database/
COPY apps/web/package*.json ./apps/web/

RUN npm ci

# Copy source files
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Build Next.js with standalone mode enabled
ENV NODE_ENV=production
ENV BUILD_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace=@menugo/web

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache wget && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone server and static assets
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
