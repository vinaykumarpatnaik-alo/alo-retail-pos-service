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
scopes = "read_users,write_customers,write_draft_orders,write_fulfillments,write_gift_cards,write_inventory,write_order_edits,write_orders,write_products,write_returns"
use_legacy_install_flow = true

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
