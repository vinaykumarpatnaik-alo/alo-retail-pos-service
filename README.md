# Alo Retail POS Service

Retail-owned POS application, middleware, Shopify POS extensions, and employee-event workers for the phased migration off the ecomm-owned POS stack.

## Structure

- `apps/frontend`: Preact + Polaris web components app surface.
- `apps/middleware`: Node.js Lambda + Elysia runtime for health checks, runtime config, Shopify helper APIs, and async event submission.
- `extensions/*`: Shopify POS extension surfaces migrated from `alo-pos-apps`.
- `workers/employee-order-events`: SQS consumer that ports the relevant legacy order-processor logic and updates HRIS employee-order/spend APIs.
- `packages/pos-domain`: shared event contracts, store cohort logic, and runtime host helpers.
- `packages/runtime-config`: app-owned `local`/`dev`/`qa`/`prod` non-secret runtime config shared by middleware and workers.
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
```

The frontend loads Shopify App Bridge and Polaris web components from Shopify's CDN. Use `bun run dev` for the Shopify app preview flow; keep that process running so Shopify CLI can hot reload extension changes and show POS extension preview/QR output the same way as `alo-pos-apps`. Shopify CLI starts the frontend and middleware through their `shopify.web.toml` files. Bun remains the install/build/test/deploy toolchain. The deployed middleware and worker images run on the AWS Node.js Lambda runtime. Shopify `orders/paid` and `orders/updated` events are routed through EventBridge and SQS to the employee-order worker; `/pos/v1/employee-orders/{email_id}` and `/pos/v1/employee-orders/{email_id}/{order_id}` proxy the HRIS order-processor-compatible read contract.

## Shopify App Config

Shopify app TOML is generated at deploy time from real app IDs. Set `SHOPIFY_APP_ENV` to `dev`, `qa`, or `prod`, set `SHOPIFY_CLIENT_ID` to the matching retail Shopify app client ID, then run `bun run shopify:config`. The generated `shopify.app.generated.toml` is intentionally ignored.

Legacy `SHOPIFY_API_KEY` in `alo-pos-apps` meant the Shopify app client ID, and legacy `SHOPIFY_API_SECRET` meant the Shopify app client secret. In this retail repo, the app client ID is `SHOPIFY_CLIENT_ID`, the app client secret is `SHOPIFY_CLIENT_SECRET`, and `SHOPIFY_API_KEY` is reserved for the optional Shopify Admin API key/token used by inventory lookup. Runtime credentials live in one AWS Secrets Manager JSON secret at `/retail/alo-retail-pos-service/runtime/${env}`. Terraform creates/replicates/grants that secret and passes `RETAIL_SECRET_ROOT`; the app fetches and caches the runtime JSON secret at runtime. For extension deploys, GitHub Actions reads `/retail/alo-retail-pos-service/shopify-extension/${env}` at deploy time through AWS OIDC to get the Shopify client ID and app automation token.

## Runtime Environment Config

Non-secret URLs, timeout values, HRIS base URL, and fallback product exclusion lists are app-owned config in `packages/runtime-config/src/runtime-config.json`. The config has `local`, `dev`, `qa`, and `prod` profiles; `packages/runtime-config/src/index.ts` loads it and hydrates the env names expected by middleware and workers. Local development defaults to `RUNTIME_CONFIG_ENV=local`; deployed Lambda uses `ENV=dev|qa|prod`. Individual local overrides can still be supplied through `.env` with `ALO_API_BASE_URL`, `STOREFULFILLMENT_URL`, `GUEST_STATUS_SET_LL`, `HRIS_USER_SYNC_BASE_URL`, `SHOPIFY_API_TIMEOUT`, `DEFAULT_API_TIMEOUT`, or `EXCLUSION_PRODUCT_LIST` when testing a specific dependency.

Static Shopify app configs are also present for local/manual use:

- `shopify.app.alo-retail-pos-dev.toml`
- `shopify.app.alo-retail-pos-qa.toml`
- `shopify.app.alo-retail-pos-prod.toml`

Extension deploys use one workflow per environment: `.github/workflows/deploy-extensions-dev.yml`, `.github/workflows/deploy-extensions-qa.yml`, and `.github/workflows/deploy-extensions-prod.yml`. Dev extension deploys run manually or from `release*` / `Release*` branches when `extensions/**` changes. QA extension deploys run manually or from `QA*` branches when `extensions/**` changes. Prod extension deploys run from published `pos-extensions/vX.Y.Z` releases, or from `pos-full/vX.Y.Z` releases when runtime and extensions should deploy together. Each workflow fetches `/retail/alo-retail-pos-service/shopify-extension/${env}` from AWS Secrets Manager and calls `bun run deploy` with `clientId` and `appAutomationToken` from that JSON secret.

## One-Time Migration

Use `bun run migrate:config -- --env dev --source-profile alo-ecomm-dev --target-profile alo-retail-dev` to dry-run the default POS table backfill. Add `--config docs/migration-config.example.json` for explicit secret mappings, and add `--apply` only after dry-run checks pass.
