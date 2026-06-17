# Migration Runbook

1. Apply the retail Terraform foundation in dev.
2. Dry-run one-time table/config migration from `alo-pos-apps` into the retail env:
   `bun run migrate:config -- --env dev --source-profile alo-ecomm-dev --target-profile alo-retail-dev --config docs/migration-config.example.json`
3. Apply the migration only after reviewing the dry run:
   `bun run migrate:config -- --env dev --source-profile alo-ecomm-dev --target-profile alo-retail-dev --config docs/migration-config.example.json --apply`
4. Confirm runtime env outputs from Terraform and verify all retail Secrets Manager values exist for the env.
5. Deploy the runtime Lambda image behind `https://api.dev.aloyoga.com/pos/v1/*`.
6. Smoke test `/health`, `/pos` controlled 404, `/pos/v1/runtime`, app load, OAuth callback URLs, `POST /pos/v1/events/employee-order`, and `GET /pos/v1/employee-orders/{email_id}`.
7. Deploy Shopify POS extensions to the dev Shopify app.
8. Move a small dev/test store cohort to the retail POS app.
9. Verify Shopify app sessions create/read in `retail-dev-pos-session-data` through `SHOPIFY_SESSION_TABLE_NAME`.
10. Verify employee-order messages land in SQS, update HRIS employee-order/spend APIs, and do not grow regional DLQs.
11. Repeat in QA.
12. For production, pilot selected stores while ecomm `alo-pos-apps` remains live.
13. Verify HRIS lookup parity and employee discount behavior before expanding cohorts.
14. Cut stores over by extension deployment/app config, not by moving all stores at once.

## Event Flow

1. Shopify Events Ingress forwards Shopify `orders/paid` and `orders/updated` events from all required Shopify instances to the retail EventBridge bus. If the platform ingress path does not contain every required instance, mirror the existing ecommerce routing pattern for the missing instances until platform forwarding is complete.
2. Retail POS EventBridge rules send matching events to regional employee-order SQS queues.
3. `workers/employee-order-events` consumes batches from regional SQS.
4. Worker computes the same employee-order snapshot as the legacy order processor from discount codes, `Employee_Email_ID`, refunds, fulfillments, line item discount allocations, and HRIS employee/config lookups.
5. Worker calls HRIS `PUT /employee-orders`, refreshes the employee order summary, and updates HRIS employee spend/suspension through `PATCH /employees/{employee_id}/spend`.
6. Failed messages retry and then land in the regional DLQ.
7. CloudWatch alarms should watch queue age, worker errors, and DLQ depth before expanding cohorts.

Supported topics are `orders/paid` and `orders/updated`. Returns and exchanges, including online returns for orders created in POS, come through as `orders/updated` with the complete Shopify order payload. The worker recalculates the full HRIS employee-order snapshot from that payload instead of applying deltas.

Read endpoints:

- `GET /pos/v1/employee-orders/{email_id}/{order_id}` proxies HRIS and returns the materialized employee order or `404`.
- `GET /pos/v1/employee-orders/{email_id}?workerType=FT|SL` proxies HRIS and returns `{ orders, current_spent_sum }` using the same FT calendar-year and SL Feb-to-Jan spend windows as the legacy order processor.

## One-Time Data And Secret Migration

The migration script is intentionally dry-run by default and uses AWS CLI profiles so ecomm and retail credentials stay separate. In `docs/migration-config.example.json`, only `tables[]`, `secretObjects[]`, and `secrets[]` are active copy inputs; `tableInventory` and `notMigratedSecrets` are documentation to keep inclusive legacy names visible.

Default table backfill:

| Legacy table | Retail table | TTL | Notes |
| --- | --- | --- | --- |
| `alo_pos_apps_session_data` | `retail-${env}-pos-session-data` | Disabled | Shopify app session storage. Requires `id` PK and `shop-index` GSI on `shop`. Offline session records should not be DynamoDB-expired. |
| `pos_alo_access_feature_configs` | `retail-${env}-pos-feature-configs` | Disabled | POS feature/config flags. |
| `pos_alo_access_exclusion_list` | `retail-${env}-pos-exclusion-list` | Enabled on `ttl` | Temporary collection/product exclusions. Preserve active `ttl` values. |

Inclusive legacy table inventory:

| Legacy table | Retail handling | Migrate? | Notes |
| --- | --- | --- | --- |
| `alo_pos_apps_session_data` | `retail-${env}-pos-session-data` | Yes | Main Shopify app session table for the unified retail POS app. |
| `pos_alo_access_feature_configs` | `retail-${env}-pos-feature-configs` | Yes | POS feature/config data. |
| `pos_alo_access_exclusion_list` | `retail-${env}-pos-exclusion-list` | Yes | POS exclusion data. Preserve `ttl`. |
| `pos_signup_customer_session_data` | Use `retail-${env}-pos-session-data` going forward | No | Do not migrate as a separate table. Add Signup Customer now shares the unified retail POS app session table. |
| `pos_alo_access_session_data` | Use `retail-${env}-pos-session-data` going forward | No | Do not migrate as a separate table. Alo Access now shares the unified retail POS app session table. |

`docs/migration-config.example.json` keeps the same inclusive names in `tableInventory`, with the two old split session tables marked `migrate: false`. They are listed for visibility only; they are not active copy inputs.

Session backfill is table-shape compatible, but token validity depends on Shopify app identity. If the retail app uses a different Shopify `client_id` than the legacy app, stores must install/authorize the retail app so Shopify creates new offline sessions for the retail app in `retail-${env}-pos-session-data`. Backfilled legacy offline tokens should only be treated as usable when the app/client identity matches.

Secrets must be mapped explicitly in `docs/migration-config.example.json` or an env-specific copy of that file. The script copies values into the Terraform-created retail secret names and never prints secret values to stdout.

Legacy secret inventory from `alo-pos-apps`:

| Legacy secret | Meaning | Legacy env usage | Retail target |
| --- | --- | --- |
| `/ecomm/shopify/posapp/aloapps/alo_apps_api_key` | Shopify app client ID | New env `SHOPIFY_CLIENT_ID` | JSON field `clientId` in `/retail/alo-retail-pos-service/shopify/${env}` |
| `/ecomm/shopify/posapp/aloapps/alo_apps_secret_key` | Shopify app client secret | New env `SHOPIFY_CLIENT_SECRET` | JSON field `clientSecret` in `/retail/alo-retail-pos-service/shopify/${env}` |
| Inventory Shopify Admin API key/token, if still required | Inventory helper token | `SHOPIFY_API_KEY` | Optional JSON field `apiKey` in `/retail/alo-retail-pos-service/shopify/${env}` after the legacy source is confirmed. |
| `/ecomm/shopify/posapp/aloapps/ebf/alo_apps_api_key` | EBF Shopify app client ID | EBF legacy `SHOPIFY_API_KEY` | Use only if migrating an EBF-equivalent env/app. |
| `/ecomm/shopify/posapp/aloapps/ebf/alo_apps_secret_key` | EBF Shopify app client secret | EBF legacy `SHOPIFY_API_SECRET` | Use only if migrating an EBF-equivalent env/app. |
| `/ecomm/shopify/posapp/aloapps/cli_token` | Legacy Shopify CLI token | legacy extension deploy `SHOPIFY_CLI_TOKEN` | Not migrated. New extension deploys use GitHub Actions secrets: `SHOPIFY_RETAIL_POS_DEV_AUTOMATION_TOKEN`, `SHOPIFY_RETAIL_POS_QA_AUTOMATION_TOKEN`, and `SHOPIFY_RETAIL_POS_PROD_AUTOMATION_TOKEN`. |
| `/ecomm/shopify/posapp/aloapps/alo_api_key` | Alo API key | New env `ALO_API_KEY` | JSON field `apiKey` in `/retail/alo-retail-pos-service/alo-api/${env}` |
| `/ecomm/shopify/posapp/aloapps/alo_api_secret` | Alo API secret | New env `ALO_API_SECRET_KEY` | JSON field `apiSecret` in `/retail/alo-retail-pos-service/alo-api/${env}` |
| `/ecomm/loyaltylion/wishlist/api_token` | LoyaltyLion API token | `LOYALTYLION_API_TOKEN` | JSON field `apiToken` in `/retail/alo-retail-pos-service/loyalty-pos/${env}` |
| `/ecomm/loyaltylion/wishlist/api_secret` | LoyaltyLion API secret | `LOYALTYLION_API_SECRET` | JSON field `apiSecret` in `/retail/alo-retail-pos-service/loyalty-pos/${env}` |
| `/ecomm/sdd/app/api_key` | Store fulfillment API key | `STOREFULFILLMENT_API_KEY` | JSON field `apiKey` in `/retail/alo-retail-pos-service/store-fulfillment/${env}` |
| `/ecomm/sdd/app/api_secret` | Store fulfillment API secret | `STOREFULFILLMENT_API_SECRET_KEY` | JSON field `apiSecret` in `/retail/alo-retail-pos-service/store-fulfillment/${env}` |

AWS also contains `/ecomm/shopify/posapp/alo_rewards_api_key`, `/ecomm/shopify/posapp/alo_rewards_secret_key`, and EBF variants under the same prefix. They were not referenced by the current `alo-pos-apps` runtime paths checked for this migration, so include them only if a separately owned rewards flow is confirmed in scope.

Placement rule:

- Runtime values belong in AWS Secrets Manager. Keep each credential pair as one JSON secret: `/retail/alo-retail-pos-service/shopify/${env}`, `/retail/alo-retail-pos-service/alo-api/${env}`, `/retail/alo-retail-pos-service/loyalty-pos/${env}`, and `/retail/alo-retail-pos-service/store-fulfillment/${env}`.
- Terraform should create/replicate those secret resources, grant the runtime Lambda `secretsmanager:GetSecretValue` on `/retail/${local.repo_name}/*`, and pass `RETAIL_SECRET_ROOT=/retail/${local.repo_name}` plus `ENV`.
- The app fetches grouped JSON secrets at runtime through Powertools and caches them in the warm Lambda container for `SECRETS_CACHE_TTL_SECONDS` seconds, defaulting to 900.
- GitHub Actions secrets are only for deploy-time Shopify extension inputs in the current workflow: `SHOPIFY_RETAIL_POS_*_CLIENT_ID` for TOML generation and `SHOPIFY_RETAIL_POS_*_AUTOMATION_TOKEN` for Shopify CLI authentication.
- The Shopify client secret should not be needed in GitHub Actions for extension deploys.
- Keeping the client ID in GitHub Actions is acceptable because Shopify CLI needs it to render/deploy the app TOML. If we later want the client ID to live only in AWS Secrets Manager, update the extension deploy workflow to fetch it through AWS OIDC before running `bun run shopify:config`.

Application helper wiring does not change. The runtime config loader reads the grouped JSON secret fields and hydrates the env names the copied POS helpers expect.

Required environment wiring per env:

| Env var | Expected value |
| --- | --- |
| `SHOPIFY_SESSION_TABLE_NAME` | `retail-${env}-pos-session-data` |
| `POS_FEATURE_CONFIGS_TABLE` | `retail-${env}-pos-feature-configs` |
| `POS_EXCLUSION_LIST_TABLE` | `retail-${env}-pos-exclusion-list` |
| `RETAIL_SECRET_ROOT` | `/retail/alo-retail-pos-service`; app derives `${RETAIL_SECRET_ROOT}/shopify/${ENV}`, `${RETAIL_SECRET_ROOT}/alo-api/${ENV}`, `${RETAIL_SECRET_ROOT}/loyalty-pos/${ENV}`, and `${RETAIL_SECRET_ROOT}/store-fulfillment/${ENV}`. |
| `SECRETS_CACHE_TTL_SECONDS` | Optional runtime secret cache TTL. Defaults to `900`. |
| `ALO_API_BASE_URL` | Non-secret Alo API base URL. Terraform-owned env coordinate; app derives Alo loyalty/birthday helper endpoints from this base. |
| `STOREFULFILLMENT_URL` | Non-secret store fulfillment base URL. Terraform-owned env coordinate; dev/qa mirror legacy QA, prod mirrors legacy prod. |
| `GUEST_STATUS_SET_LL` | Non-secret LoyaltyLion activities endpoint. Terraform-owned env coordinate. |
| `EXCLUSION_PRODUCT_LIST` | Legacy product exclusion list. Terraform-owned env coordinate unless business wants it promoted into `retail-${env}-pos-feature-configs`. |
| `SHOPIFY_API_TIMEOUT` / `DEFAULT_API_TIMEOUT` | Non-secret timeout config. Terraform-owned env coordinate. |

## Failover

- Runtime Lambda, SQS, worker Lambda, and POS-owned DynamoDB table replicas exist in `us-east-1` and `us-west-2`.
- CloudFront registers both regional API Gateway origins but routes to `local.cdn_active_origin_region` because the shared CDN module does not support CloudFront origin groups.
- To fail over the app edge, change `cdn_active_origin_region` in Terraform to `local.secondary_region`, apply, and verify `/health` through `pos.*.alo.technology`.
- Keep DynamoDB global table replication healthy before store cohort expansion. Shopify session, feature config, and exclusion list tables are POS-owned; employee-order history and spend remain HRIS-owned.
- During failover, keep store cohorts pinned to the last known-good app config. Replay DLQ messages only after the primary incident is stable.

## What Is Not Migrated 

The full ecomm order processor is not part of this service. Retail employee discount order tracking is migrated here; remaining non-retail responsibilities, such as loyalty reward redemption, should stay in `alo-pos-order-processor` until retired or moved to their owning services.
