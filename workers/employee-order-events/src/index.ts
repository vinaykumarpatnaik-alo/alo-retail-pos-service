import {Logger} from "@aws-lambda-powertools/logger";
import type {Context, SQSBatchResponse, SQSEvent, SQSRecord} from "aws-lambda";
import {
  parseEmployeeOrderEvent,
  type EmployeeOrderEvent,
  type ShopifyOrderPayload,
} from "@alo-retail-pos-service/pos-domain";

const logger = new Logger({serviceName: process.env.POWERTOOLS_SERVICE_NAME ?? "alo-retail-pos-service-employee-order-events"});

interface HrisEmployee {
  id: string;
  annual_limit?: string;
  worker_type?: string;
}

interface HrisEmployeeOrder {
  email_id: string;
  order_id: string;
  current_total: string;
  current_total_discounts: string;
  has_employee_discount: boolean;
  current_spent: string;
  eligible_items: number;
  customer_id: string;
  shopify_email: string;
  employee_id: string;
  line_item_ids: string[];
  refund_line_item_ids: string[];
  created_at: string;
}

interface EmployeeOrderSnapshot {
  order_id: string;
  current_total: string;
  current_total_discounts: string;
  has_employee_discount: boolean;
  employee_email?: string;
  current_spent: string;
  eligible_items: number;
  customer_id: string;
  shopify_email: string;
  employee_id: string;
  line_item_ids: string[];
  refund_line_item_ids: string[];
  created_at: string;
}

export async function handler(event: SQSEvent, context?: Context): Promise<SQSBatchResponse> {
  if (context) logger.addContext(context);
  logger.logEventIfEnabled(event);

  const failures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      logger.error("failed to process employee-order event", {
        messageId: record.messageId,
        error: errorToLog(error),
      });
      failures.push({itemIdentifier: record.messageId});
    }
  }

  return {batchItemFailures: failures};
}

export async function processRecord(record: SQSRecord): Promise<void> {
  const employeeOrderEvent = parseEmployeeOrderEvent(JSON.parse(record.body));
  await processEmployeeDiscountOrder(employeeOrderEvent);

  logger.info("processed employee-order event", {
    eventId: employeeOrderEvent.eventId,
    topic: employeeOrderEvent.topic,
    orderId: stringValue(employeeOrderEvent.order.id),
  });
}

async function processEmployeeDiscountOrder(event: EmployeeOrderEvent): Promise<void> {
  const discountCode = await getEmployeeDiscountCode();
  if (!discountCode) {
    logger.info("employee discount config is disabled or missing");
    return;
  }

  const existingOrder = await getExistingEmployeeOrderFromOrder(event.order);
  const snapshot = buildEmployeeOrderSnapshot(event.order, discountCode, existingOrder);
  if (!snapshot.has_employee_discount) {
    logger.info("order does not have employee discount", {orderId: snapshot.order_id});
    return;
  }
  if (!snapshot.employee_email) {
    logger.error("order has employee discount but is missing Employee_Email_ID", {orderId: snapshot.order_id});
    return;
  }

  const employee = await lookupEmployeeByEmail(snapshot.employee_email);
  if (!employee) {
    logger.error("employee not found for discounted order", {
      employeeEmail: snapshot.employee_email,
      orderId: snapshot.order_id,
    });
    return;
  }

  const orderPayload: HrisEmployeeOrder = {
    email_id: snapshot.employee_email,
    order_id: snapshot.order_id,
    current_total: snapshot.current_total,
    current_total_discounts: snapshot.current_total_discounts,
    has_employee_discount: snapshot.has_employee_discount,
    current_spent: snapshot.current_spent,
    eligible_items: snapshot.eligible_items,
    customer_id: snapshot.customer_id,
    shopify_email: snapshot.shopify_email,
    employee_id: employee.id,
    line_item_ids: snapshot.line_item_ids,
    refund_line_item_ids: snapshot.refund_line_item_ids,
    created_at: snapshot.created_at,
  };

  await putEmployeeOrder(orderPayload);
  await updateEmployeeSpend(employee, orderPayload);

  logger.info("upserted employee order and refreshed HRIS spend", {
    employeeEmail: orderPayload.email_id,
    employeeId: orderPayload.employee_id,
    orderId: orderPayload.order_id,
    currentSpent: orderPayload.current_spent,
  });
}

function buildEmployeeOrderSnapshot(
  order: ShopifyOrderPayload,
  discountCode: string,
  existingOrder?: HrisEmployeeOrder,
): EmployeeOrderSnapshot {
  const customer = recordValue(order.customer);
  const snapshot: EmployeeOrderSnapshot = {
    order_id: stringValue(order.id),
    current_total: stringValue(order.current_total_price, "0"),
    current_total_discounts: stringValue(order.current_total_discounts, "0"),
    has_employee_discount: false,
    employee_email: undefined,
    current_spent: "0",
    eligible_items: 0,
    customer_id: stringValue(customer.id),
    shopify_email: stringValue(customer.email),
    employee_id: existingOrder?.employee_id ?? "",
    line_item_ids: [],
    refund_line_item_ids: [],
    created_at: stringValue(order.created_at),
  };

  if (!hasDiscountCode(order, discountCode)) return snapshot;

  snapshot.has_employee_discount = true;
  snapshot.employee_email = employeeEmailFromOrder(order);
  if (!snapshot.employee_email) return snapshot;

  const refundItemsMap = refundItemsFromOrder(order);
  if (refundItemsMap.size === 0 && existingOrder?.refund_line_item_ids) {
    for (const refundLineItem of existingOrder.refund_line_item_ids) {
      const [lineItemId, quantity] = String(refundLineItem).split("-");
      const normalizedQuantity = Number(quantity);
      if (lineItemId && Number.isFinite(normalizedQuantity)) {
        refundItemsMap.set(lineItemId, normalizedQuantity);
      }
    }
  }

  let currentSpent = 0;
  for (const fulfillment of arrayValue(order.fulfillments)) {
    for (const lineItem of arrayValue(recordValue(fulfillment).line_items)) {
      const line = recordValue(lineItem);
      const discounts = arrayValue(line.discount_allocations);
      if (discounts.length === 0) continue;

      const itemId = stringValue(line.id);
      const quantity = numberValue(line.quantity);
      const effectiveQuantity = Math.max(0, quantity - (refundItemsMap.get(itemId) ?? 0));
      if (effectiveQuantity <= 0 || quantity <= 0) continue;

      snapshot.eligible_items += effectiveQuantity;
      snapshot.line_item_ids.push(`${itemId}-${effectiveQuantity}`);

      for (const discount of discounts) {
        const amount = numberValue(recordValue(discount).amount);
        if (amount <= 0) continue;

        const discountPerQuantity = amount / quantity;
        const itemPriceTotal = numberValue(line.price) * effectiveQuantity;
        const itemDiscountTotal = discountPerQuantity * effectiveQuantity;
        currentSpent += itemPriceTotal - itemDiscountTotal;
      }
    }
  }

  snapshot.current_spent = String(currentSpent);
  snapshot.refund_line_item_ids = [...refundItemsMap.entries()].map(([itemId, quantity]) => `${itemId}-${quantity}`);
  return snapshot;
}

async function updateEmployeeSpend(employee: HrisEmployee, order: HrisEmployeeOrder): Promise<void> {
  const workerType = employee.worker_type || "FT";
  const annualSpendLimit = await getAnnualSpendLimit(workerType);
  if (!annualSpendLimit.enabled) {
    logger.info("employee threshold check disabled", {workerType});
    return;
  }

  const individualLimit = Number(employee.annual_limit ?? 0);
  const limit = individualLimit > 0 ? individualLimit : annualSpendLimit.value;
  const summary = await getEmployeeOrderSummary(order.email_id, workerType);
  const currentSpent = Number(summary.current_spent_sum ?? 0);
  const suspended = limit <= currentSpent;

  await hrisRequest(`/employees/${encodeURIComponent(employee.id)}/spend`, {
    method: "PATCH",
    body: JSON.stringify({
      current_spent: String(currentSpent),
      suspended,
      previous_order_date: order.created_at,
    }),
  });
}

async function getEmployeeDiscountCode(): Promise<string | undefined> {
  const response = await hrisRequest("/retail-config/Employee%20Discount", {method: "GET"});
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`HRIS employee discount config lookup failed with status ${response.status}`);

  const payload = (await response.json()) as {item?: Record<string, unknown>};
  const item = payload.item ?? {};
  if (!booleanValue(item.enabled)) return undefined;
  const discountCode = stringValue(item.discountcode);
  return discountCode || undefined;
}

async function lookupEmployeeByEmail(email: string): Promise<HrisEmployee | undefined> {
  const response = await hrisRequest(`/employees/lookup/email?email=${encodeURIComponent(email)}`, {method: "GET"});
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`HRIS employee lookup failed with status ${response.status}`);

  const payload = (await response.json()) as {employee?: HrisEmployee; payload?: {employee?: HrisEmployee}};
  return payload.employee ?? payload.payload?.employee;
}

async function getExistingEmployeeOrderFromOrder(order: ShopifyOrderPayload): Promise<HrisEmployeeOrder | undefined> {
  const orderId = stringValue(order.id);
  const employeeEmail = employeeEmailFromOrder(order);
  if (!orderId || !employeeEmail) return undefined;

  const response = await hrisRequest(`/employee-orders/${encodeURIComponent(employeeEmail)}/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`HRIS employee order lookup failed with status ${response.status}`);
  return response.json() as Promise<HrisEmployeeOrder>;
}

async function putEmployeeOrder(order: HrisEmployeeOrder): Promise<void> {
  await hrisRequest("/employee-orders", {
    method: "PUT",
    body: JSON.stringify(order),
  });
}

async function getEmployeeOrderSummary(email: string, workerType: string): Promise<{current_spent_sum: number}> {
  const response = await hrisRequest(`/employee-orders/${encodeURIComponent(email)}?workerType=${encodeURIComponent(workerType)}`, {
    method: "GET",
  });
  if (!response.ok) throw new Error(`HRIS employee order summary failed with status ${response.status}`);
  return response.json() as Promise<{current_spent_sum: number}>;
}

async function getAnnualSpendLimit(workerType: string): Promise<{enabled: boolean; value: number}> {
  const response = await hrisRequest(`/retail-config/annual-spend-limit?workerType=${encodeURIComponent(workerType)}`, {
    method: "GET",
  });
  if (response.status === 404) return {enabled: false, value: 0};
  if (!response.ok) throw new Error(`HRIS annual spend limit lookup failed with status ${response.status}`);

  const payload = (await response.json()) as {enabled?: boolean; value?: string | number};
  return {
    enabled: Boolean(payload.enabled),
    value: Number(payload.value ?? 0),
  };
}

function hasDiscountCode(order: ShopifyOrderPayload, discountCode: string): boolean {
  return arrayValue(order.discount_codes).some((discount) => stringValue(recordValue(discount).code) === discountCode);
}

function employeeEmailFromOrder(order: ShopifyOrderPayload): string | undefined {
  for (const note of arrayValue(order.note_attributes)) {
    const item = recordValue(note);
    if (stringValue(item.name) === "Employee_Email_ID") {
      return stringValue(item.value) || undefined;
    }
  }
  return undefined;
}

function refundItemsFromOrder(order: ShopifyOrderPayload): Map<string, number> {
  const refundItemsMap = new Map<string, number>();
  for (const refund of arrayValue(order.refunds)) {
    for (const refundLineItem of arrayValue(recordValue(refund).refund_line_items)) {
      const item = recordValue(refundLineItem);
      const lineItemId = stringValue(item.line_item_id);
      const quantity = numberValue(item.quantity);
      if (!lineItemId || quantity <= 0) continue;
      refundItemsMap.set(lineItemId, (refundItemsMap.get(lineItemId) ?? 0) + quantity);
    }
  }
  return refundItemsMap;
}

async function hrisRequest(path: string, init: RequestInit): Promise<Response> {
  const baseUrl = requiredEnv("HRIS_USER_SYNC_BASE_URL");
  const token = process.env.HRIS_USER_SYNC_TOKEN || process.env.ALO_HRIS_USER_SYNC_TOKEN || "";
  const timeoutMs = Number(process.env.HRIS_USER_SYNC_TIMEOUT_MS || process.env.ALO_HRIS_USER_SYNC_TIMEOUT_MS || 5000);
  const url = new URL(path, baseUrl).toString();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 5000),
  });

  if (!response.ok && init.method !== "GET") {
    throw new Error(`HRIS employee order request failed with status ${response.status}`);
  }
  return response;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  return Boolean(value);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function errorToLog(error: unknown): Record<string, string | undefined> | string {
  if (error instanceof Error) {
    return {name: error.name, message: error.message, stack: error.stack};
  }
  return String(error);
}
