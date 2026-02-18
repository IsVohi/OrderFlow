FROM node:20-alpine AS base
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.15.5 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/inventory-service/package.json ./apps/inventory-service/
COPY apps/inventory-service/src/infrastructure/persistence/prisma ./apps/inventory-service/src/infrastructure/persistence/prisma
COPY tsconfig.base.json ./
RUN pnpm install --frozen-lockfile
# Build workspace packages
RUN pnpm --filter './packages/*' build

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=dependencies /app/apps/inventory-service/node_modules ./apps/inventory-service/node_modules
COPY --from=dependencies /app/apps/inventory-service/src/infrastructure/persistence ./apps/inventory-service/src/infrastructure/persistence
COPY apps/inventory-service ./apps/inventory-service
COPY tsconfig.base.json ./
WORKDIR /app/apps/inventory-service
# Generate Prisma client
RUN ../../node_modules/.pnpm/prisma@*/node_modules/prisma/build/index.js generate --schema=src/infrastructure/persistence/prisma/schema.prisma

RUN pnpm build

FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/inventory-service/node_modules ./apps/inventory-service/node_modules
COPY --from=build /app/apps/inventory-service/dist ./apps/inventory-service/dist
COPY --from=build /app/apps/inventory-service/package.json ./apps/inventory-service/package.json
COPY --from=build /app/apps/inventory-service/src/generated/client ./apps/inventory-service/dist/generated/client

WORKDIR /app/apps/inventory-service
EXPOSE 3002
CMD ["node", "dist/main.js"]
