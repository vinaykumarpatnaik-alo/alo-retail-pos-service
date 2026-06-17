export interface ShopifyRuntimeConfig {
  apiKey: string;
  appUrl: string;
  sessionTableName: string;
}

export function getShopifyRuntimeConfig(env: Record<string, string | undefined>): ShopifyRuntimeConfig {
  const apiKey = env.SHOPIFY_CLIENT_ID;
  const appUrl = env.APP_URL;
  const sessionTableName = env.SHOPIFY_SESSION_TABLE_NAME;

  if (!apiKey) throw new Error("SHOPIFY_CLIENT_ID is required");
  if (!appUrl) throw new Error("APP_URL is required");
  if (!sessionTableName) throw new Error("SHOPIFY_SESSION_TABLE_NAME is required");

  return {
    apiKey,
    appUrl,
    sessionTableName,
  };
}
