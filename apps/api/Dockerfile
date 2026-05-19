# Multi-stage Dockerfile for Homelander API and Worker
# Pinned to exact stable LTS version: 22.11.0-alpine

# --- Base Node.js Environment ---
FROM public.ecr.aws/docker/library/node:22.11.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# --- Dependencies & Build Stage ---
FROM base AS builder
WORKDIR /app

# Install standard dependencies (needed by native packages if any)
RUN apk add --no-cache python3 make g++ gcc libc-dev

# Copy package lock, workspace definitions, and TS base configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY shared/types/package.json ./shared/types/

# Fetch and cache dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY apps/api ./apps/api
COPY shared/types ./shared/types

# Compile TypeScript (this compiles both shared types references and the API code)
RUN pnpm --filter @humyn/api build

# Prune non-production dependencies to keep the image extremely small
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod --no-optional

# --- Production Runtime Stage ---
FROM public.ecr.aws/docker/library/node:22.11.0-alpine AS runner
WORKDIR /app

# Install runtime utilities (like curl for EKS liveness/readiness check probes)
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=8080

# Configure permissions for the pre-defined non-root 'node' user
RUN chown -R node:node /app

# Switch to the non-root user
USER node

# Copy built files with proper ownership to prevent permission conflicts
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
# Copy raw SQL migrations so EKS Init Containers or Jobs can apply schemas securely in production
COPY --chown=node:node --from=builder /app/apps/api/src/db/migrations ./apps/api/src/db/migrations
COPY --chown=node:node --from=builder /app/shared/types ./shared/types

WORKDIR /app/apps/api

# Expose API server port
EXPOSE 8080

# Default entrypoint for main API container (Overridden in worker deployment)
CMD ["node", "dist/index.js"]
