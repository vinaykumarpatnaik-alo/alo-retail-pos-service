export type RuntimeEnvironment = "dev" | "qa" | "prod";

export type PosRuntime = "ecomm" | "retail-polaris";

export interface StoreCohort {
  storeId: string;
  runtime: PosRuntime;
}

export interface RetailDomainConfig {
  ecommBaseUrl: string;
  retailBaseUrl: string;
  environment: RuntimeEnvironment;
}

export function retailPosHost(environment: RuntimeEnvironment): string {
  if (environment === "prod") return "https://api.aloyoga.com";
  return `https://api.${environment}.aloyoga.com`;
}

export function resolvePosBaseUrl(
  cohort: StoreCohort | undefined,
  config: RetailDomainConfig,
): string {
  if (cohort?.runtime === "retail-polaris") return config.retailBaseUrl;
  return config.ecommBaseUrl;
}

export interface HrisLookupRequest {
  storeId: string;
  employeeId?: string;
  email?: string;
  phone?: string;
}

export interface HrisLookupResult {
  employeeId: string;
  eligible: boolean;
  source: "hris";
}

export const employeeOrderEventTopics = ["orders/paid", "orders/updated"] as const;

export type EmployeeOrderEventTopic = (typeof employeeOrderEventTopics)[number];

export type ShopifyOrderPayload = Record<string, unknown>;

export interface EmployeeOrderEvent {
  eventId: string;
  topic: EmployeeOrderEventTopic;
  occurredAt: string;
  source: "eventbridge" | "shopify-pos-extension" | "middleware" | "backfill";
  shopDomain?: string;
  order: ShopifyOrderPayload;
  metadata?: Record<string, string | number | boolean | null>;
}

export function isEmployeeOrderEventTopic(value: unknown): value is EmployeeOrderEventTopic {
  return typeof value === "string" && employeeOrderEventTopics.includes(value as EmployeeOrderEventTopic);
}

export function normalizeEmployeeOrderEvent(
  body: unknown,
  defaults: {eventId?: string; occurredAt?: string; source?: EmployeeOrderEvent["source"]} = {},
): EmployeeOrderEvent {
  if (!body || typeof body !== "object") {
    throw new Error("employee order event payload is required");
  }

  const input = body as Partial<EmployeeOrderEvent> & {
    detail?: {metadata?: Record<string, unknown>; payload?: unknown};
    id?: unknown;
    eventType?: unknown;
    payload?: unknown;
    time?: unknown;
  };
  const isEventBridgeEnvelope = Boolean(input.detail?.payload);
  const detailMetadata = input.detail?.metadata ?? {};
  const topic = normalizeTopic(input.topic ?? input.eventType ?? detailMetadata["X-Shopify-Topic"]);
  const order = normalizeOrderPayload(input.order ?? input.detail?.payload ?? input.payload ?? body);
  const event: EmployeeOrderEvent = {
    eventId: stringOrDefault(input.eventId ?? input.id, defaults.eventId),
    topic,
    occurredAt: stringOrDefault(input.occurredAt ?? input.time, defaults.occurredAt),
    source: normalizeSource(isEventBridgeEnvelope ? "eventbridge" : input.source ?? defaults.source),
    shopDomain: optionalString(input.shopDomain ?? detailMetadata["X-Shopify-Shop-Domain"]),
    order,
    metadata: normalizeMetadata(input.metadata ?? detailMetadata),
  };

  validateEmployeeOrderEvent(event);
  return event;
}

export function parseEmployeeOrderEvent(body: unknown): EmployeeOrderEvent {
  const event = normalizeEmployeeOrderEvent(body, {source: undefined});
  validateEmployeeOrderEvent(event);
  return event;
}

export function validateEmployeeOrderEvent(event: EmployeeOrderEvent): void {
  const requiredFields: Array<keyof EmployeeOrderEvent> = [
    "eventId",
    "topic",
    "occurredAt",
    "source",
    "order",
  ];

  for (const field of requiredFields) {
    if (event[field] === undefined || event[field] === null || event[field] === "") {
      throw new Error(`missing employee-order event field: ${field}`);
    }
  }

  if (!isEmployeeOrderEventTopic(event.topic)) {
    throw new Error(`unsupported employee-order event topic: ${String(event.topic)}`);
  }
}

function normalizeTopic(value: unknown): EmployeeOrderEventTopic {
  if (isEmployeeOrderEventTopic(value)) return value;
  throw new Error(`unsupported employee order event topic: ${String(value)}`);
}

function normalizeSource(value: unknown): EmployeeOrderEvent["source"] {
  if (value === "eventbridge" || value === "shopify-pos-extension" || value === "middleware" || value === "backfill") {
    return value;
  }
  throw new Error(`unsupported employee order event source: ${String(value)}`);
}

function normalizeOrderPayload(value: unknown): ShopifyOrderPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("employee order event requires a Shopify order payload");
  }
  return value as ShopifyOrderPayload;
}

function normalizeMetadata(value: unknown): EmployeeOrderEvent["metadata"] {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("metadata must be an object");
  }

  return value as EmployeeOrderEvent["metadata"];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stringOrDefault(value: unknown, fallback: string | undefined): string {
  const normalized = typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
  if (!normalized) throw new Error("eventId and occurredAt defaults are required when missing from payload");
  return normalized;
}
