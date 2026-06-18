FROM oven/bun:1.3.14-slim AS bun-base
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/pos-domain/package.json packages/pos-domain/package.json
COPY packages/shopify-auth/package.json packages/shopify-auth/package.json
RUN bun install --frozen-lockfile

COPY apps apps
COPY packages packages
COPY scripts scripts

FROM bun-base AS frontend-build
RUN bun run --cwd apps/frontend build

FROM bun-base AS api-build
COPY --from=frontend-build /app/apps/frontend/dist apps/api/public
RUN bun run --cwd apps/api build

FROM public.ecr.aws/lambda/nodejs:22 AS api
WORKDIR ${LAMBDA_TASK_ROOT}
ENV NODE_ENV=production

COPY --from=api-build /app/package.json package.json
COPY --from=api-build /app/node_modules node_modules
COPY --from=api-build /app/apps/api/package.json apps/api/package.json
COPY --from=api-build /app/apps/api/dist apps/api/dist
COPY --from=api-build /app/apps/api/public apps/api/public
COPY --from=api-build /app/packages packages

CMD ["apps/api/dist/index.lambdaHandler"]

FROM bun-base AS worker-build
RUN bun run --cwd apps/worker build

FROM public.ecr.aws/lambda/nodejs:22 AS worker
WORKDIR ${LAMBDA_TASK_ROOT}
ENV NODE_ENV=production

COPY --from=worker-build /app/package.json package.json
COPY --from=worker-build /app/node_modules node_modules
COPY --from=worker-build /app/apps/worker/package.json apps/worker/package.json
COPY --from=worker-build /app/apps/worker/dist apps/worker/dist
COPY --from=worker-build /app/packages packages

CMD ["apps/worker/dist/index.handler"]
