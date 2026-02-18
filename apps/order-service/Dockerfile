FROM node:20-alpine AS base
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.15.5 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/order-service/package.json ./apps/order-service/
COPY apps/order-service/src/infrastructure/persistence/prisma ./apps/order-service/src/infrastructure/persistence/prisma
COPY tsconfig.base.json ./
RUN pnpm install --frozen-lockfile
# Build workspace packages
RUN pnpm --filter './packages/*' build
# Generate Prisma client
WORKDIR /app/apps/order-service
RUN ../../node_modules/.pnpm/prisma@*/node_modules/prisma/build/index.js generate --schema=src/infrastructure/persistence/prisma/schema.prisma
WORKDIR /app

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=dependencies /app/apps/order-service/node_modules ./apps/order-service/node_modules
COPY --from=dependencies /app/apps/order-service/src/infrastructure/persistence ./apps/order-service/src/infrastructure/persistence
COPY apps/order-service ./apps/order-service
COPY tsconfig.base.json ./
WORKDIR /app/apps/order-service
RUN pnpm build

FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/order-service/node_modules ./apps/order-service/node_modules
COPY --from=build /app/apps/order-service/dist ./apps/order-service/dist
COPY --from=build /app/apps/order-service/package.json ./apps/order-service/package.json

WORKDIR /app/apps/order-service
EXPOSE 3001
CMD ["node", "dist/main.js"]
