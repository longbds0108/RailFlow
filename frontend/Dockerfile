# ArcFlow frontend (Next.js standalone) — build context MUST be the repo root.
# ---- builder ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./

# NEXT_PUBLIC_* are inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_ARC_CHAIN_ID
ARG NEXT_PUBLIC_ARC_RPC_URL
ARG NEXT_PUBLIC_ARC_EXPLORER_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_KIT_KEY
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_PAYMENT_RECEIVER
ENV NEXT_PUBLIC_ARC_CHAIN_ID=$NEXT_PUBLIC_ARC_CHAIN_ID \
    NEXT_PUBLIC_ARC_RPC_URL=$NEXT_PUBLIC_ARC_RPC_URL \
    NEXT_PUBLIC_ARC_EXPLORER_URL=$NEXT_PUBLIC_ARC_EXPLORER_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_KIT_KEY=$NEXT_PUBLIC_KIT_KEY \
    NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    NEXT_PUBLIC_PAYMENT_RECEIVER=$NEXT_PUBLIC_PAYMENT_RECEIVER
RUN npm run build

# ---- runtime (standalone) ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app/frontend
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
