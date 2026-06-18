import {getSecret} from "@aws-lambda-powertools/parameters/secrets";

type RuntimeSecret = Readonly<Record<string, unknown>>;

type RuntimeSecretStatus = {
  readonly fieldNames: readonly string[];
  readonly isLoaded: boolean;
  readonly isPlaceholder: boolean;
  readonly secretId: string;
};

const placeholderValues = new Set(["", "PLACEHOLDER_UPDATE_MANUALLY"]);

let runtimeSecretsExpiresAt = 0;
let runtimeSecretsPromise: Promise<RuntimeSecretStatus> | undefined;

export async function ensureRuntimeSecrets(): Promise<RuntimeSecretStatus | undefined> {
  const secretId = runtimeSecretId();
  if (!secretId) return undefined;

  const now = Date.now();
  if (now < runtimeSecretsExpiresAt) {
    return {
      fieldNames: [],
      isLoaded: true,
      isPlaceholder: false,
      secretId,
    };
  }

  if (!runtimeSecretsPromise) {
    runtimeSecretsPromise = loadAndConfigureRuntimeSecrets(secretId)
      .then((status) => {
        runtimeSecretsExpiresAt = Date.now() + secretsCacheTtlMs();
        return status;
      })
      .finally(() => {
        runtimeSecretsPromise = undefined;
      });
  }

  return runtimeSecretsPromise;
}

export async function loadRuntimeSecretStatus(): Promise<RuntimeSecretStatus | undefined> {
  const secretId = runtimeSecretId();
  if (!secretId) return undefined;

  const rawSecret = await getSecret(secretId, {
    maxAge: secretsCacheTtlSeconds(),
  });

  return parseRuntimeSecret(secretId, secretText(rawSecret));
}

export function parseRuntimeSecret(secretId: string, rawValue: string | undefined): RuntimeSecretStatus {
  const trimmedValue = rawValue?.trim() ?? "";

  if (placeholderValues.has(trimmedValue)) {
    return {
      fieldNames: [],
      isLoaded: false,
      isPlaceholder: true,
      secretId,
    };
  }

  const parsed = JSON.parse(trimmedValue) as unknown;
  if (!isRuntimeSecret(parsed)) {
    throw new Error(`Runtime secret ${secretId} must be a JSON object`);
  }

  return {
    fieldNames: Object.keys(parsed).sort(),
    isLoaded: true,
    isPlaceholder: false,
    secretId,
  };
}

async function loadAndConfigureRuntimeSecrets(secretId: string): Promise<RuntimeSecretStatus> {
  const rawSecret = await getSecret(secretId, {
    maxAge: secretsCacheTtlSeconds(),
  });
  const text = secretText(rawSecret);
  const status = parseRuntimeSecret(secretId, text);
  if (!status.isLoaded) return status;

  const runtime = parseRuntimeSecretValue(secretId, text);

  setRequiredEnv("SHOPIFY_CLIENT_ID", stringField(runtime, "shopifyClientId", "runtime"));
  setRequiredEnv("SHOPIFY_CLIENT_SECRET", stringField(runtime, "shopifyClientSecret", "runtime"));
  setOptionalEnv("SHOPIFY_API_KEY", optionalStringField(runtime, "shopifyApiKey"));
  setRequiredEnv("ALO_API_KEY", stringField(runtime, "aloApiKey", "runtime"));
  setRequiredEnv("ALO_API_SECRET_KEY", stringField(runtime, "aloApiSecretKey", "runtime"));
  setRequiredEnv("LOYALTYLION_API_TOKEN", stringField(runtime, "loyaltylionApiToken", "runtime"));
  setRequiredEnv("LOYALTYLION_API_SECRET", stringField(runtime, "loyaltylionApiSecret", "runtime"));
  setRequiredEnv("STOREFULFILLMENT_API_KEY", stringField(runtime, "storeFulfillmentApiKey", "runtime"));
  setRequiredEnv("STOREFULFILLMENT_API_SECRET_KEY", stringField(runtime, "storeFulfillmentApiSecretKey", "runtime"));
  setOptionalEnv("HRIS_USER_SYNC_TOKEN", optionalStringField(runtime, "hrisUserSyncToken"));

  return status;
}

function parseRuntimeSecretValue(secretId: string, rawValue: string | undefined): RuntimeSecret {
  const trimmedValue = rawValue?.trim() ?? "";
  const parsed = JSON.parse(trimmedValue) as unknown;
  if (!isRuntimeSecret(parsed)) {
    throw new Error(`Runtime secret ${secretId} must be a JSON object`);
  }
  return parsed;
}

function runtimeSecretId(): string {
  return process.env.RETAIL_RUNTIME_SECRET_ARN?.trim() || process.env.RETAIL_RUNTIME_SECRET_NAME?.trim() || "";
}

function secretsCacheTtlSeconds(): number {
  const ttl = Number.parseInt(process.env.SECRETS_CACHE_TTL_SECONDS ?? "900", 10);
  return Number.isFinite(ttl) && ttl >= 0 ? ttl : 900;
}

function secretsCacheTtlMs(): number {
  return secretsCacheTtlSeconds() * 1000;
}

function secretText(secretValue: unknown): string | undefined {
  if (typeof secretValue === "string") return secretValue;
  if (secretValue instanceof Uint8Array) return Buffer.from(secretValue).toString("utf8");
  return undefined;
}

function isRuntimeSecret(value: unknown): value is RuntimeSecret {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(secret: RuntimeSecret, field: string, secretName: string): string {
  const value = secret[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${secretName}.${field} is required`);
  }
  return value;
}

function optionalStringField(secret: RuntimeSecret, field: string): string | undefined {
  const value = secret[field];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function setRequiredEnv(name: string, value: string): void {
  process.env[name] = value;
}

function setOptionalEnv(name: string, value: string | undefined): void {
  if (value) process.env[name] = value;
}
