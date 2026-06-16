import {writeFileSync} from "node:fs";

const envName = requiredEnv("SHOPIFY_APP_ENV");
const clientId = requiredEnv("SHOPIFY_CLIENT_ID");

const configs = {
  dev: {
    name: "Alo Retail POS Dev",
    applicationUrl: "https://api.dev.aloyoga.com/pos/v1/",
    handle: "alo-retail-pos-dev",
  },
  qa: {
    name: "Alo Retail POS QA",
    applicationUrl: "https://api.qa.aloyoga.com/pos/v1/",
    handle: "alo-retail-pos-qa",
  },
  prod: {
    name: "Alo Retail POS",
    applicationUrl: "https://api.aloyoga.com/pos/v1/",
    handle: "alo-retail-pos",
  },
};

const config = configs[envName];
if (!config) {
  throw new Error(`Unsupported SHOPIFY_APP_ENV: ${envName}`);
}

const callbackBase = config.applicationUrl.replace(/\/$/, "");
const toml = `client_id = "${escapeToml(clientId)}"
name = "${config.name}"
application_url = "${config.applicationUrl}"
embedded = true
handle = "${config.handle}"

[webhooks]
api_version = "2026-04"

[access_scopes]
scopes = "read_all_orders,read_apps,read_customer_events,read_cart_transforms,write_cart_transforms,read_all_cart_transforms,write_checkouts,read_checkouts,read_custom_fulfillment_services,write_custom_fulfillment_services,read_customers,write_customers,read_discounts_allocator_functions,write_discounts_allocator_functions,write_draft_orders,read_draft_orders,read_gift_cards,write_gift_cards,write_inventory,read_inventory,read_locales,write_locales,write_locations,read_locations,read_metaobject_definitions,write_metaobject_definitions,read_metaobjects,write_metaobjects,write_order_edits,read_order_edits,read_orders,write_orders,read_products,write_products,read_returns,write_returns,read_content,write_content,customer_write_customers,customer_read_customers,customer_read_orders,customer_write_orders"
use_legacy_install_flow = false

[auth]
redirect_urls = [
  "${callbackBase}/auth/callback",
  "${callbackBase}/auth/shopify/callback",
  "${callbackBase}/api/auth/callback"
]

[pos]
embedded = true
`;

writeFileSync("shopify.app.generated.toml", toml);
console.log(`Rendered shopify.app.generated.toml for ${envName}`);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function escapeToml(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
