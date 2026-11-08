# syntax=docker/dockerfile:1
# Production image for Kamal (config/deploy.yml). A single `web` role runs `node .output/server/index.mjs`.
# Migrations, seeding and the 08:00 reminder cron all run inside the server (server/plugins/init.ts), so there is
# no separate worker. Nitro bundles runtime dependencies (including better-sqlite3's native binding) into .output,
# so the runtime stage only needs .output.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -qq \
  && apt-get install --no-install-recommends -y ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- build ------------------------------------------------------------------------
FROM base AS build
# Toolchain for better-sqlite3, in case no prebuilt binary matches and it compiles from source
RUN apt-get update -qq \
  && apt-get install --no-install-recommends -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
# Install from the lockfile alone, so this layer survives code changes. Scripts are skipped here because the
# root postinstall (`nuxt prepare`) needs the source; `npm rebuild` below runs the dependencies' install scripts.
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm rebuild
# Heap for nuxt build; raise it with `builder.args.BUILD_HEAP_MB` in config/deploy.yml on bigger builders
ARG BUILD_HEAP_MB=3072
RUN NODE_OPTIONS=--max-old-space-size=${BUILD_HEAP_MB} npx nuxt build

# --- runtime ----------------------------------------------------------------------
FROM base AS runtime
# sqlite3 CLI for `kamal sqlite`
RUN apt-get update -qq \
  && apt-get install --no-install-recommends -y sqlite3 \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 \
  DATABASE_URL=/data/db/crm.db UPLOAD_DIR=/data/uploads
COPY --from=build --chown=node:node /app/.output /app/.output
COPY --chown=node:node bin/docker-entrypoint /app/bin/docker-entrypoint
# The persistent volume mounts at /data. A new named volume takes this directory's owner, so the app (user node)
# can write to it.
RUN mkdir -p /data/db /data/uploads && chown -R node:node /data
USER node
EXPOSE 3000
ENTRYPOINT ["/app/bin/docker-entrypoint"]
CMD ["web"]
