FROM node:22.18-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@logina/worker..."
RUN pnpm --filter "@logina/worker..." build
RUN pnpm --filter @logina/worker deploy --prod /out

FROM node:22.18-slim
ENV NODE_ENV=production
ENV PROMPT_DIR=/app/prompts
WORKDIR /app
COPY --from=build /out .
USER node
CMD ["node", "dist/server.js"]
