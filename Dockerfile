FROM node:25-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY pricing-tables ./pricing-tables

RUN pnpm build

RUN pnpm prune --prod

FROM node:25-alpine

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S app && adduser -S app -u 1001

WORKDIR /app

COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/pricing-tables ./pricing-tables
COPY package.json ./

USER app

EXPOSE 8888 8889

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node --input-type=commonjs -e "require('node:http').get('http://localhost:8889/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

ENTRYPOINT ["dumb-init", "node", "dist/cli.js"]
CMD ["serve"]
