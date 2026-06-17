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

The migration script is intentionally dry-run by default and uses AWS CLI profiles so ecomm and retail credentials stay separate.

Default table backfill:

| Legacy table | Retail table | TTL | Notes |
| --- | --- | --- | --- |
| `alo_pos_apps_session_data` | `retail-${env}-pos-session-data` | Disabled | Shopify app session storage. Requires `id` PK and `shop-index` GSI on `shop`. Offline session records should not be DynamoDB-expired. |
| `pos_alo_access_feature_configs` | `retail-${env}-pos-feature-configs` | Disabled | POS feature/config flags. |
| `pos_alo_access_exclusion_list` | `retail-${env}-pos-exclusion-list` | Enabled on `ttl` | Temporary collection/product exclusions. Preserve active `ttl` values. |

`pos_signup_customer_session_data` and `pos_alo_access_session_data` are not wired as separate retail tables. Add Signup Customer and Alo Access now run under the unified retail POS app boundary and use `retail-${env}-pos-session-data` for Shopify app sessions.

Session backfill is table-shape compatible, but token validity depends on Shopify app identity. If the retail app uses a different Shopify `client_id` than the legacy app, stores must install/authorize the retail app so Shopify creates new offline sessions for the retail app in `retail-${env}-pos-session-data`. Backfilled legacy offline tokens should only be treated as usable when the app/client identity matches.

Secrets must be mapped explicitly in `docs/migration-config.example.json` or an env-specific copy of that file. The script copies values into the Terraform-created retail secret names and never prints secret values to stdout.

Required environment wiring per env:

| Env var | Expected value |
| --- | --- |
| `SHOPIFY_SESSION_TABLE_NAME` | `retail-${env}-pos-session-data` |
| `POS_FEATURE_CONFIGS_TABLE` | `retail-${env}-pos-feature-configs` |
| `POS_EXCLUSION_LIST_TABLE` | `retail-${env}-pos-exclusion-list` |
| `SHOPIFY_API_KEY_SECRET_NAME` | `/retail/alo-retail-pos-service/shopify/key/${env}` or direct `SHOPIFY_API_KEY` |

## Failover

- Runtime Lambda, SQS, worker Lambda, and POS-owned DynamoDB table replicas exist in `us-east-1` and `us-west-2`.
- CloudFront registers both regional API Gateway origins but routes to `local.cdn_active_origin_region` because the shared CDN module does not support CloudFront origin groups.
- To fail over the app edge, change `cdn_active_origin_region` in Terraform to `local.secondary_region`, apply, and verify `/health` through `pos.*.alo.technology`.
- Keep DynamoDB global table replication healthy before store cohort expansion. Shopify session, feature config, and exclusion list tables are POS-owned; employee-order history and spend remain HRIS-owned.
- During failover, keep store cohorts pinned to the last known-good app config. Replay DLQ messages only after the primary incident is stable.

## What Is Not Migrated 

The full ecomm order processor is not part of this service. Retail employee discount order tracking is migrated here; remaining non-retail responsibilities, such as loyalty reward redemption, should stay in `alo-pos-order-processor` until retired or moved to their owning services.
