# =========================
# Build stage
# =========================
FROM node:20-alpine AS builder

# Prisma binaries need these on Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
COPY prisma ./prisma
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# =========================
# Production stage
# =========================
FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy only what runtime needs
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["npm", "start"]
