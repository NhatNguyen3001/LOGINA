FROM node:22.18-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@logina/api..."
RUN pnpm --filter "@logina/api..." build
RUN pnpm --filter @logina/api deploy --prod /out

FROM node:22.18-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
CMD ["node", "dist/server.js"]
