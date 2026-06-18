import {promises as fs} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {Logger} from "@aws-lambda-powertools/logger";
import {getSecret} from "@aws-lambda-powertools/parameters/secrets";
import {Elysia} from "elysia";
import type {APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult, Context} from "aws-lambda";
import {configureMiddlewareRuntimeConfig} from "@alo-retail-pos-service/runtime-config";
// @ts-expect-error copied POS route adapter is JavaScript so helper logic stays out of TypeScript checking.
import {posRoutes} from "./pos-routes.js";

configureMiddlewareRuntimeConfig();

const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(dirname, "../public");
const indexHtmlPath = path.resolve(publicDir, "index.html");
const port = Number(process.env.PORT ?? "8080");
const logger = new Logger({serviceName: process.env.POWERTOOLS_SERVICE_NAME ?? "alo-retail-pos-service-middleware"});
const secretsCacheTtlMs = Number(process.env.SECRETS_CACHE_TTL_SECONDS ?? "900") * 1000;
let runtimeSecretsExpiresAt = 0;
let runtimeSecretsPromise: Promise<void> | undefined;

function runtimePayload() {
  return {
    appUrl: process.env.APP_URL,
    employeeOrderEventsSource: "eventbridge-worker",
    hrisUserSyncBaseUrl: process.env.HRIS_USER_SYNC_BASE_URL,
    shopifyClientIdConfigured: Boolean(process.env.SHOPIFY_CLIENT_ID),
    posTables: {
      session: process.env.SESSION_DATA_TABLE_NAME,
      featureConfigs: process.env.FEATURE_CONFIGS_TABLE_NAME,
      exclusionList: process.env.EXCLUSION_LIST_TABLE_NAME,
    },
  };
}

function unversionedPosResponse(set: {status?: number | string}) {
  set.status = 404;
  return {ok: false, error: "versioned_pos_api_required"};
}

export const app = new Elysia()
  .onError(({error, set}) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("middleware request failed", error as Error);
    if (!set.status || set.status === 200) {
      set.status = 500;
    }
    return {ok: false, error: message};
  })
  .onBeforeHandle(async ({path}) => {
    if (path !== "/health") {
      await ensureRuntimeSecrets();
      configureMiddlewareRuntimeConfig();
    }
  })
  .get("/health", () => ({
    ok: true,
    app: "alo-retail-pos-service",
    stack: process.env.APP_STACK ?? "retail-pos",
  }))
  .get("/pos", ({set}) => unversionedPosResponse(set))
  .get("/pos/", ({set}) => unversionedPosResponse(set))
  .get("/pos/v1/runtime", runtimePayload)
  .use(posRoutes)
  .get("/", renderIndexResponse)
  .get("/*", serveStaticOrIndex);

export async function lambdaHandler(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, context?: Context): Promise<APIGatewayProxyResult> {
  if (context) logger.addContext(context);
  logger.logEventIfEnabled(event);
  const response = await app.handle(toRequest(event));
  return toProxyResult(response);
}

if (!process.env.AWS_LAMBDA_RUNTIME_API && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(port);
  logger.info("alo-retail-pos-service middleware listening", {port});
}

async function serveStaticOrIndex({request}: {request: Request}): Promise<Response> {
  const requestPath = new URL(request.url).pathname;
  const staticResponse = await tryServeStaticFile(requestPath);
  return staticResponse ?? renderIndexResponse();
}

async function tryServeStaticFile(requestPath: string): Promise<Response | undefined> {
  const decodedPath = decodeURIComponent(requestPath);
  const filePath = path.resolve(publicDir, `.${decodedPath}`);
  if (!filePath.startsWith(`${publicDir}${path.sep}`)) return undefined;

  const fileStat = await fs.stat(filePath).catch(() => undefined);
  if (!fileStat?.isFile()) return undefined;

  return new Response(await fs.readFile(filePath), {
    headers: {"content-type": contentTypeFor(filePath)},
  });
}

async function renderIndexResponse(): Promise<Response> {
  const html = await renderIndexHtml();
  return new Response(html, {
    headers: {"content-type": "text/html; charset=utf-8"},
  });
}

async function renderIndexHtml(): Promise<string> {
  const [html, shopifyClientId] = await Promise.all([fs.readFile(indexHtmlPath, "utf8"), process.env.SHOPIFY_CLIENT_ID?.trim() ?? ""]);
  return html.replaceAll("__SHOPIFY_CLIENT_ID__", escapeHtmlAttribute(shopifyClientId));
}

async function ensureRuntimeSecrets(): Promise<void> {
  const secretId = runtimeSecretId();
  if (!secretId) return;

  const now = Date.now();
  if (now < runtimeSecretsExpiresAt) return;

  if (!runtimeSecretsPromise) {
    runtimeSecretsPromise = loadRuntimeSecrets(secretId)
      .then(() => {
        runtimeSecretsExpiresAt = Date.now() + secretsCacheTtlMs;
      })
      .finally(() => {
        runtimeSecretsPromise = undefined;
      });
  }

  await runtimeSecretsPromise;
}

async function loadRuntimeSecrets(secretId: string): Promise<void> {
  const runtime = await readJsonSecret(secretId);

  setRequiredEnv("SHOPIFY_CLIENT_ID", stringField(runtime, "shopifyClientId", "runtime"));
  setRequiredEnv("SHOPIFY_CLIENT_SECRET", stringField(runtime, "shopifyClientSecret", "runtime"));
  setOptionalEnv("SHOPIFY_API_KEY", optionalStringField(runtime, "shopifyApiKey"));
  setRequiredEnv("ALO_API_KEY", stringField(runtime, "aloApiKey", "runtime"));
  setRequiredEnv("ALO_API_SECRET_KEY", stringField(runtime, "aloApiSecretKey", "runtime"));
  setRequiredEnv("LOYALTYLION_API_TOKEN", stringField(runtime, "loyaltylionApiToken", "runtime"));
  setRequiredEnv("LOYALTYLION_API_SECRET", stringField(runtime, "loyaltylionApiSecret", "runtime"));
  setRequiredEnv("STOREFULFILLMENT_API_KEY", stringField(runtime, "storeFulfillmentApiKey", "runtime"));
  setRequiredEnv("STOREFULFILLMENT_API_SECRET_KEY", stringField(runtime, "storeFulfillmentApiSecretKey", "runtime"));
}

async function readJsonSecret(secretId: string): Promise<Record<string, unknown>> {
  const secretValue = await getSecret(secretId);
  if (!secretValue) throw new Error(`Secret ${secretId} is empty`);
  const secretText = typeof secretValue === "string" ? secretValue : Buffer.from(secretValue).toString("utf8");
  const parsed = JSON.parse(secretText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Secret ${secretId} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function stringField(secret: Record<string, unknown>, field: string, secretName: string): string {
  const value = secret[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${secretName}.${field} is required`);
  }
  return value;
}

function setRequiredEnv(name: string, value: string): void {
  process.env[name] = value;
}

function optionalStringField(secret: Record<string, unknown>, field: string): string | undefined {
  const value = secret[field];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function setOptionalEnv(name: string, value: string | undefined): void {
  if (value) process.env[name] = value;
}

function runtimeSecretId(): string {
  return process.env.RETAIL_RUNTIME_SECRET_ARN?.trim() ?? "";
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function toRequest(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Request {
  const method = "version" in event ? event.requestContext.http.method : event.httpMethod;
  const pathName = "rawPath" in event ? event.rawPath : event.path;
  const queryString = "rawQueryString" in event ? event.rawQueryString : toQueryString(event.queryStringParameters);
  const proto = headerValue(event.headers, "x-forwarded-proto") ?? "https";
  const host = headerValue(event.headers, "host") ?? "localhost";
  const url = `${proto}://${host}${pathName}${queryString ? `?${queryString}` : ""}`;
  const body = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : event.body
    : undefined;

  return new Request(url, {
    method,
    headers: event.headers as HeadersInit,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}

async function toProxyResult(response: Response): Promise<APIGatewayProxyResult> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const contentType = response.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await response.arrayBuffer());
  const isBase64Encoded = !isTextContentType(contentType);

  return {
    statusCode: response.status,
    headers,
    body: isBase64Encoded ? buffer.toString("base64") : buffer.toString("utf8"),
    isBase64Encoded,
  };
}

function toQueryString(query: APIGatewayProxyEvent["queryStringParameters"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.append(key, value);
    }
  }
  return params.toString();
}

function headerValue(headers: APIGatewayProxyEvent["headers"] | APIGatewayProxyEventV2["headers"], name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === normalizedName) return value;
  }
  return undefined;
}

function isTextContentType(contentType: string): boolean {
  return (
    contentType.startsWith("text/") ||
    contentType.includes("json") ||
    contentType.includes("javascript") ||
    contentType.includes("xml") ||
    contentType.includes("svg")
  );
}

function contentTypeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
  };

  return contentTypes[extension] ?? "application/octet-stream";
}
