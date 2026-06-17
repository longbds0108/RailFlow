# RailFlow backend — build context MUST be the repo root (needs ../config).
# ---- builder: install deps (better-sqlite3 native build) ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm install --omit=dev

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=builder /app/backend/node_modules ./node_modules
COPY backend/ ./
# Shared config lives at repo root /app/config (backend resolves ../../config).
COPY config/ /app/config/
RUN mkdir -p /app/backend/data
EXPOSE 4000
CMD ["node", "src/index.js"]
