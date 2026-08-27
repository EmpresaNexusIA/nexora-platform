FROM node:22-bookworm-slim

RUN corepack enable \
    && corepack prepare pnpm@11.10.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/api/package.json apps/api/package.json
COPY packages/context/package.json packages/context/package.json
COPY packages/database/package.json packages/database/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/context packages/context
COPY packages/database packages/database

RUN rm -f packages/context/tsconfig.tsbuildinfo && pnpm --filter @nexora/context build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

CMD ["pnpm", "--filter", "@nexora/api", "start"]
