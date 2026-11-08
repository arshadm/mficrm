# syntax=docker/dockerfile:1
# Production image for Kamal (config/deploy.yml), built the same way as stepwise. A single `web` role:
# bin/docker-entrypoint applies pending Prisma migrations, then runs `node .output/server/index.mjs`.
# Seeding and the 08:00 reminder cron run inside the server (server/plugins/init.ts), so there is no separate worker.
# The Prisma CLI runs migrations at boot, so the image keeps the full dependency tree.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -qq \
  && apt-get install --no-install-recommends -y ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# --- build ------------------------------------------------------------------------
FROM base AS build
# Install from the lockfile alone, so this layer survives code changes. Scripts are skipped here because the
# root postinstall (`prisma generate && nuxt prepare`) needs the source.
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund
COPY . .
# prisma.config.ts reads DATABASE_URL; `prisma generate` never connects, so a placeholder will do
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# Runs the dependencies' install scripts and the root postinstall (prisma generate && nuxt prepare)
RUN npm rebuild
# Heap for nuxt build; raise it with `builder.args.BUILD_HEAP_MB` in config/deploy.yml on bigger builders
ARG BUILD_HEAP_MB=3072
RUN NODE_OPTIONS=--max-old-space-size=${BUILD_HEAP_MB} npx nuxt build

# --- runtime ----------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 UPLOAD_DIR=/data/uploads
COPY --from=build --chown=node:node /app /app
# prisma and the other CLIs
ENV PATH=/app/node_modules/.bin:$PATH
# Uploads live on a persistent volume mounted at /data. A new named volume takes this directory's owner, so the
# app (user node) can write to it.
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3000
ENTRYPOINT ["/app/bin/docker-entrypoint"]
CMD ["web"]
