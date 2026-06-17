import "@shopify/shopify-api/adapters/node";
import {ApiVersion, shopifyApi} from "@shopify/shopify-api";
import {restResources} from "@shopify/shopify-api/rest/admin/2025-07";

const scopes = (process.env.SCOPES || process.env.SHOPIFY_SCOPES || "")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

const hostName = (process.env.HOST || process.env.APP_URL || "https://api.aloyoga.com").replace(/^https?:\/\//, "");

const api = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July25,
  hostName,
  hostScheme: hostName.startsWith("localhost") ? "http" : "https",
  isEmbeddedApp: true,
  restResources,
  scopes,
});

export default {api};
