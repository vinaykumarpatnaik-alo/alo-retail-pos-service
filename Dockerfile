FROM oven/bun:1.3.14-slim AS bun-base
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/middleware/package.json apps/middleware/package.json
COPY packages/pos-domain/package.json packages/pos-domain/package.json
COPY packages/shopify-auth/package.json packages/shopify-auth/package.json
COPY workers/employee-order-events/package.json workers/employee-order-events/package.json
RUN bun install --frozen-lockfile

COPY apps apps
COPY packages packages
COPY scripts scripts
COPY workers workers

FROM bun-base AS frontend-build
RUN bun run --cwd apps/frontend build

FROM bun-base AS middleware-build
COPY --from=frontend-build /app/apps/frontend/dist apps/middleware/public
RUN bun run --cwd apps/middleware build

FROM public.ecr.aws/lambda/nodejs:22 AS runtime-lambda
WORKDIR ${LAMBDA_TASK_ROOT}
ENV NODE_ENV=production

COPY --from=middleware-build /app/package.json package.json
COPY --from=middleware-build /app/node_modules node_modules
COPY --from=middleware-build /app/apps/middleware/package.json apps/middleware/package.json
COPY --from=middleware-build /app/apps/middleware/dist apps/middleware/dist
COPY --from=middleware-build /app/apps/middleware/public apps/middleware/public
COPY --from=middleware-build /app/packages packages

CMD ["apps/middleware/dist/index.lambdaHandler"]

FROM bun-base AS employee-order-events-build
RUN bun run --cwd workers/employee-order-events build

FROM public.ecr.aws/lambda/nodejs:22 AS employee-order-events-worker-lambda
WORKDIR ${LAMBDA_TASK_ROOT}
ENV NODE_ENV=production

COPY --from=employee-order-events-build /app/package.json package.json
COPY --from=employee-order-events-build /app/node_modules node_modules
COPY --from=employee-order-events-build /app/workers/employee-order-events/package.json workers/employee-order-events/package.json
COPY --from=employee-order-events-build /app/workers/employee-order-events/dist workers/employee-order-events/dist
COPY --from=employee-order-events-build /app/packages packages

CMD ["workers/employee-order-events/dist/index.handler"]
