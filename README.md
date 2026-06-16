# Alo Retail POS Service

Retail-owned POS application, middleware, Shopify POS extensions, and employee-event workers for the phased migration off the ecomm-owned POS stack.

## Structure

- `apps/frontend`: Preact + Polaris web components app surface.
- `apps/middleware`: Node.js Lambda + Elysia runtime for health checks, runtime config, Shopify helper APIs, and async event submission.
- `extensions/*`: Shopify POS extension surfaces migrated from `alo-pos-apps`.
- `workers/employee-order-events`: SQS consumer that idempotently persists retail employee order events and updates the HRIS employee-order APIs.
- `packages/pos-domain`: shared event contracts, store cohort logic, and runtime host helpers.
- `packages/shopify-auth`: shared Shopify app/session helpers.
- `infra/README.md`: points to the central Terraform role in `alo-terraform`.

The ecomm `alo-pos-order-processor` is intentionally not copied here. Employee identity and employee-order history come from HRIS user-sync; retail POS owns POS app state/config and the employee-order EventBridge/SQS worker path.

## Domains

- Dev: `api.dev.aloyoga.com/pos/v1/*`
- QA: `api.qa.aloyoga.com/pos/v1/*`
- Prod: `api.aloyoga.com/pos/v1/*`

## Local Development

```sh
bun install
bun run dev
bun run dev:frontend
bun run dev:middleware
```

The frontend loads Shopify App Bridge and Polaris web components from Shopify's CDN. Use `bun run dev` for the Shopify app preview flow, and use `bun run dev:frontend` or `bun run dev:middleware` when you only want the local frontend or middleware process. Bun remains the build/test/deploy toolchain. The deployed middleware and worker images run on the AWS Node.js Lambda runtime. Shopify `orders/paid` and `orders/updated` events are routed through EventBridge and SQS to the employee-order worker; `/pos/v1/employee-orders/{email_id}` and `/pos/v1/employee-orders/{email_id}/{order_id}` proxy the HRIS order-processor-compatible read contract.

## Shopify App Config

Shopify app TOML is generated at deploy time from real app IDs. Set `SHOPIFY_APP_ENV` to `dev`, `qa`, or `prod`, set `SHOPIFY_CLIENT_ID` to the matching retail Shopify app client ID, then run `bun run shopify:config`. The generated `shopify.app.generated.toml` is intentionally ignored.

Extension deploys use `.github/workflows/deploy-extensions.yml`. Manual runs can target `dev`, `qa`, or `prod`; pushes to `main` deploy QA extensions; published `pos-extensions/vX.Y.Z` releases deploy prod extensions. CI reads Shopify deploy values from GitHub Actions secrets:

- `SHOPIFY_RETAIL_POS_DEV_CLIENT_ID`
- `SHOPIFY_RETAIL_POS_QA_CLIENT_ID`
- `SHOPIFY_RETAIL_POS_PROD_CLIENT_ID`
- `SHOPIFY_RETAIL_POS_DEV_AUTOMATION_TOKEN`
- `SHOPIFY_RETAIL_POS_QA_AUTOMATION_TOKEN`
- `SHOPIFY_RETAIL_POS_PROD_AUTOMATION_TOKEN`

## One-Time Migration

Use `bun run migrate:config -- --env dev --source-profile alo-ecomm-dev --target-profile alo-retail-dev` to dry-run the default POS table backfill. Add `--config docs/migration-config.example.json` for explicit secret mappings, and add `--apply` only after dry-run checks pass.
