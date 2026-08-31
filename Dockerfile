# Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY migrations ./migrations

RUN npm run build && test -f dist/main.js

# Runtime
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Bogota

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY migrations ./migrations

EXPOSE 3000

CMD ["node", "--max-old-space-size=512", "dist/main.js"]
