FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/dashboard/package.json ./apps/dashboard/
COPY tsconfig.base.json ./
RUN pnpm install --frozen-lockfile
# Build workspace packages
RUN pnpm --filter './packages/*' build

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=dependencies /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
WORKDIR /app
WORKDIR /app
COPY tsconfig.base.json ./
WORKDIR /app/apps/dashboard
COPY apps/dashboard ./
ARG NEXT_PUBLIC_ORDER_API_URL
ARG NEXT_PUBLIC_INVENTORY_API_URL
ARG NEXT_PUBLIC_PAYMENT_API_URL
ENV NEXT_PUBLIC_ORDER_API_URL=$NEXT_PUBLIC_ORDER_API_URL
ENV NEXT_PUBLIC_INVENTORY_API_URL=$NEXT_PUBLIC_INVENTORY_API_URL
ENV NEXT_PUBLIC_PAYMENT_API_URL=$NEXT_PUBLIC_PAYMENT_API_URL

RUN pnpm build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=build --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/dashboard/server.js"]
