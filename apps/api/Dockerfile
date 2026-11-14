# ==============================================================================
# MenuGo API Production Dockerfile (Multi-Stage Build)
# ==============================================================================

# --- Stage 1: Build & TypeScript Compilation ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install build essentials if needed
RUN apk add --no-cache libc6-compat

# Copy package manifests across the monorepo for caching
COPY package*.json ./
COPY packages/database/package*.json ./packages/database/
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy source code
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build backend API
RUN npm run build --workspace=@menugo/api

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

RUN apk add --no-cache wget

# Install only production dependencies
COPY package*.json ./
COPY packages/database/package*.json ./packages/database/
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled code and assets
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Use non-root node user for security
USER node

EXPOSE 5001

# Liveness healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health/live || exit 1

CMD ["node", "apps/api/dist/index.js"]
