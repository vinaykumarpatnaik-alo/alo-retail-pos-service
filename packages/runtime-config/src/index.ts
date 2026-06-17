import runtimeConfigRaw from "./runtime-config.json" with {type: "json"};

type RuntimeEnvironment = "local" | "dev" | "qa" | "prod";

type RuntimeConfig = {
  aloApiBaseUrl: string;
  storeFulfillmentUrl: string;
  guestStatusSetLl: string;
  hrisUserSyncBaseUrl: string;
  shopifyApiTimeout: string;
  defaultApiTimeout: string;
  exclusionProductList: string;
};

const runtimeConfigByEnv = runtimeConfigRaw as Record<RuntimeEnvironment, RuntimeConfig>;

export function configureMiddlewareRuntimeConfig(): void {
  const config = runtimeConfig();
  const aloApiBaseUrl = normalizedUrl(process.env.ALO_API_BASE_URL) || config.aloApiBaseUrl;

  configureWorkerRuntimeConfig();
  setRuntimeEnv("ALO_SET_GUEST_STATUS", `${aloApiBaseUrl}/v1/loyalty/activities`);
  setRuntimeEnv("BIRTHDATE_UPDATE_END_POINT", `${aloApiBaseUrl}/v1/account/birthday`);
  setRuntimeEnv("BLOCKED_CUSTOMER_END_POINT", `${aloApiBaseUrl}/v1/loyalty/blocked`);
  setRuntimeEnv("GIFTS_ENDPOINT", `${aloApiBaseUrl}/v1/loyalty/gifts`);
  setRuntimeEnv("LLREWARDS_END_POINT", `${aloApiBaseUrl}/v1/loyalty/rewards`);
  setRuntimeEnv("STOREFULFILLMENT_URL", normalizedUrl(process.env.STOREFULFILLMENT_URL) || config.storeFulfillmentUrl);
  setRuntimeEnv("GUEST_STATUS_SET_LL", normalizedUrl(process.env.GUEST_STATUS_SET_LL) || config.guestStatusSetLl);
  setRuntimeEnv("SHOPIFY_API_TIMEOUT", process.env.SHOPIFY_API_TIMEOUT?.trim() || config.shopifyApiTimeout);
  setRuntimeEnv("DEFAULT_API_TIMEOUT", process.env.DEFAULT_API_TIMEOUT?.trim() || config.defaultApiTimeout);
  setRuntimeEnv("EXCLUSION_PRODUCT_LIST", process.env.EXCLUSION_PRODUCT_LIST?.trim() || config.exclusionProductList);
}

export function configureWorkerRuntimeConfig(): void {
  const config = runtimeConfig();
  setRuntimeEnv("HRIS_USER_SYNC_BASE_URL", normalizedUrl(process.env.HRIS_USER_SYNC_BASE_URL) || config.hrisUserSyncBaseUrl);
}

function runtimeConfig(): RuntimeConfig {
  return runtimeConfigByEnv[resolvedRuntimeEnv()];
}

function resolvedRuntimeEnv(): RuntimeEnvironment {
  const env = process.env.RUNTIME_CONFIG_ENV || process.env.ENV || process.env.SHOPIFY_APP_ENV;
  if (env === "dev" || env === "qa" || env === "prod" || env === "local") return env;
  return process.env.AWS_LAMBDA_RUNTIME_API || process.env.AWS_LAMBDA_FUNCTION_NAME ? "dev" : "local";
}

function setRuntimeEnv(name: string, value: string): void {
  process.env[name] = value;
}

function normalizedUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, "") ?? "";
}
