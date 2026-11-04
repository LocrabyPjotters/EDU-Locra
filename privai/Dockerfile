# ─── Locra PrivAI™ Sovereign Enclave Dockerfile ───
# Hardened minimal attack surface container for TEE confidential execution
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json tsconfig.json ./
# Symlink or install dependencies
COPY src ./src
RUN npm install typescript -g && tsc

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PRIVAI_PORT=4100
ENV PRIVAI_HOST=0.0.0.0

# Security hardening: Run as unprivileged user
RUN addgroup -S privai && adduser -S privai -G privai

COPY package.json ./
COPY --from=builder /app/dist ./dist

# Mount tmpfs / ephemeral storage for non-persistent RAM-only execution
VOLUME ["/tmp"]

USER privai

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4100/ || exit 1

CMD ["node", "dist/index.js"]

