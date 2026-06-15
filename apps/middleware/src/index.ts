import {randomUUID} from "node:crypto";
import {promises as fs} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {Logger} from "@aws-lambda-powertools/logger";
import {getSecret} from "@aws-lambda-powertools/parameters/secrets";
import {SendMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
import {Elysia} from "elysia";
import type {APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult, Context} from "aws-lambda";
import {
  normalizeEmployeeOrderEvent,
} from "@alo-retail-pos-service/pos-domain";
// @ts-expect-error copied POS route adapter is JavaScript so helper logic stays out of TypeScript checking.
import {posRoutes} from "./pos-routes.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(dirname, "../public");
const indexHtmlPath = path.resolve(publicDir, "index.html");
const port = Number(process.env.PORT ?? "8080");
const queueRegion = process.env.EMPLOYEE_ORDER_EVENTS_QUEUE_REGION ?? process.env.AWS_REGION ?? process.env.REGION ?? "us-east-1";
const sqs = new SQSClient({region: queueRegion});
const logger = new Logger({serviceName: process.env.POWERTOOLS_SERVICE_NAME ?? "alo-retail-pos-service-middleware"});
let shopifyApiKeyPromise: Promise<string> | undefined;

function runtimePayload() {
  return {
    appUrl: process.env.APP_URL,
    employeeOrderEventsEnabled: Boolean(process.env.EMPLOYEE_ORDER_EVENTS_QUEUE_URL),
    employeeOrderEventsQueueRegion: queueRegion,
    hrisUserSyncBaseUrl: process.env.HRIS_USER_SYNC_BASE_URL,
    shopifyApiKeyConfigured: Boolean(process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_API_KEY_SECRET_NAME),
    posTables: {
      session: process.env.SHOPIFY_SESSION_TABLE_NAME,
      featureConfigs: process.env.POS_FEATURE_CONFIGS_TABLE,
      exclusionList: process.env.POS_EXCLUSION_LIST_TABLE,
    },
  };
}

function unversionedPosResponse(set: {status?: number | string}) {
  set.status = 404;
  return {ok: false, error: "versioned_pos_api_required"};
}

async function enqueueEmployeeOrderEvent(body: unknown, set: {status?: number | string}) {
  const queueUrl = process.env.EMPLOYEE_ORDER_EVENTS_QUEUE_URL;
  if (!queueUrl) {
    set.status = 503;
    return {ok: false, error: "employee_order_events_queue_not_configured"};
  }

  try {
    const event = normalizeEmployeeOrderEvent(body, {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      source: "middleware",
    });
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(event),
        MessageAttributes: {
          topic: {DataType: "String", StringValue: event.topic},
          shopDomain: {DataType: "String", StringValue: event.shopDomain ?? "unknown"},
          orderId: {DataType: "String", StringValue: String(event.order.id ?? "unknown")},
        },
      }),
    );

    set.status = 202;
    logger.info("queued employee-order event", {
      eventId: event.eventId,
      topic: event.topic,
      shopDomain: event.shopDomain,
      orderId: event.order.id,
    });
    return {ok: true, eventId: event.eventId, topic: event.topic};
  } catch (error) {
    logger.error("failed to queue employee-order event", error as Error);
    set.status = 400;
    throw error;
  }
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
  .get("/health", () => ({
    ok: true,
    app: "alo-retail-pos-service",
    stack: process.env.APP_STACK ?? "retail-pos",
  }))
  .get("/pos", ({set}) => unversionedPosResponse(set))
  .get("/pos/", ({set}) => unversionedPosResponse(set))
  .get("/pos/v1/runtime", runtimePayload)
  .post("/pos/v1/events/employee-order", ({body, set}) => enqueueEmployeeOrderEvent(body, set))
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
  const [html, shopifyApiKey] = await Promise.all([fs.readFile(indexHtmlPath, "utf8"), resolveShopifyApiKey()]);
  return html.replaceAll("__SHOPIFY_API_KEY__", escapeHtmlAttribute(shopifyApiKey));
}

async function resolveShopifyApiKey(): Promise<string> {
  const directValue = process.env.SHOPIFY_API_KEY?.trim();
  if (directValue) return directValue;

  if (!shopifyApiKeyPromise) {
    shopifyApiKeyPromise = readShopifyApiKeySecret();
  }

  return shopifyApiKeyPromise;
}

async function readShopifyApiKeySecret(): Promise<string> {
  const secretId = process.env.SHOPIFY_API_KEY_SECRET_NAME?.trim();
  if (!secretId) return "";

  const secretValue = await getSecret(secretId);
  if (!secretValue) return "";
  const secretText = typeof secretValue === "string" ? secretValue : Buffer.from(secretValue).toString("utf8");
  const parsed = parseSecretValue(secretText);
  return parsed.trim();
}

function parseSecretValue(secretText: string): string {
  try {
    const parsed = JSON.parse(secretText) as Record<string, unknown>;
    const value = parsed.SHOPIFY_API_KEY ?? parsed.shopifyApiKey ?? parsed.apiKey ?? parsed.clientId;
    return typeof value === "string" ? value : secretText;
  } catch {
    return secretText;
  }
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
