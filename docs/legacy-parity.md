# Legacy Parity Map

This repo is a retail POS replacement, not a copy of every ecomm/EDP responsibility.

## Migrated From `alo-pos-apps`

| Legacy table | Retail table | Purpose |
| --- | --- | --- |
| `alo_pos_apps_session_data` | `retail-${env}-pos-session-data` | Shopify app session storage with `shop-index` GSI. |
| `pos_alo_access_feature_configs` | `retail-${env}-pos-feature-configs` | POS feature/config flags. |
| `pos_alo_access_exclusion_list` | `retail-${env}-pos-exclusion-list` | Temporary collection/product exclusion lists with TTL. |

The old SAM app used broad `DynamoDBCrudPolicy: "*"`; the retail role scopes IAM to the POS-owned tables and SQS queue.

## Replaced Instead Of Migrated

| Legacy table/source | Retail replacement | Reason |
| --- | --- | --- |
| `alo_adp_employee_info` | HRIS user-sync service/table | HRIS is the employee source of truth. |
| `alo_adp_employee_order_info` | HRIS `employee-orders` table/API | HRIS owns the order-processor-compatible read/write model by `email_id/order_id`; Retail POS worker computes the same snapshot from Shopify events and forwards updates to HRIS. |
| `alo_adp_feature_configs` | HRIS/POS-owned config split | Legacy employee config is replaced by retail-owned POS config plus HRIS identity. |
| `alo_adp_roles_titles_permission` | HRIS user-sync / retail auth policy | Role/title permissions follow HRIS-derived employee data. |

## Not Migrated From `alo-pos-order-processor`

| Legacy table/source | Retail decision |
| --- | --- |
| `edp_shopify_order_updates` | Not migrated. The full Shopify order processor stays in ecomm until separately retired. |
| Shopify partner EventBridge bus processing | Not migrated into this service. Employee-order discount events enter through POS middleware/SQS only. |
| Order processor DLQ replay Lambda | Not migrated. New service uses regional SQS DLQs for employee-order event ingestion only. |

## Cutover Check

Before moving a store cohort, verify:

1. Shopify sessions create/read in `retail-${env}-pos-session-data`.
2. Feature flags are backfilled in `retail-${env}-pos-feature-configs`.
3. Exclusion list writes/readbacks work in `retail-${env}-pos-exclusion-list`.
4. Employee purchase/return/exchange/adjust/cancel events flow through EventBridge/SQS and update the HRIS employee-order API.
5. HRIS user-sync returns the employee records needed by employee discount flows.
