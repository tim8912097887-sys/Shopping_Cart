ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PNPM_CONFIG_STORE_DIR="/pnpm/store"
RUN corepack enable

# ==========================================
# 1. Prereq Stage: Copy all structural files
# ==========================================
FROM base AS prereq
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/user-service/package.json ./services/user-service/
COPY packages/logger/package.json ./packages/logger/

# ==========================================
# 2. Development & Build Stage
# ==========================================
FROM prereq AS builder
WORKDIR /app
# Install ALL dependencies (including devDeps for building)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy the rest of the source code (Ensure .dockerignore ignores local node_modules!)
COPY . .

# Build everything (Your workspace build command should build logger then user-service)
RUN pnpm build

# Isolate the user-service and its production dependencies into a standalone folder
# This eliminates workspace symlinks and flattens everything into /prod/user-service
RUN pnpm --filter=user-service deploy --legacy /prod/user-service

# ==========================================
# 3. Final Lean Production Stage
# ==========================================
FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /app

# Safely switch to non-root user
USER node

# Copy the isolated self-contained application from the builder stage
# This includes the exact production node_modules and the compiled shared logger!
COPY --from=builder --chown=node:node /prod/user-service ./
COPY --chown=node:node services/user-service/drizzle ./drizzle

EXPOSE 3001

# Double check your entrypoint path inside the build artifact folder
CMD ["node", "dist/server.js"]