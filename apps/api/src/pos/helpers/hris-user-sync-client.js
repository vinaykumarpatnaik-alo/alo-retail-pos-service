import axios from "axios";

const EMPLOYEE_STRING_FIELDS = [
  "id",
  "work_email",
  "personal_email",
  "preferred_first_name",
  "preferred_last_name",
  "first_name",
  "last_name",
  "work_phone",
  "work_landline",
  "personal_phone",
  "personal_landline",
  "job_title",
  "store",
  "status",
  "worker_type",
  "annual_limit",
  "current_spent",
  "previous_order_date",
  "country_code",
];

function buildUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

function unwrapEmployee(payload) {
  return payload?.employee || payload?.payload?.employee || payload?.payload || payload;
}

function hasDynamoAttributeValue(value) {
  return value && typeof value === "object" && (
    Object.prototype.hasOwnProperty.call(value, "S") ||
    Object.prototype.hasOwnProperty.call(value, "N") ||
    Object.prototype.hasOwnProperty.call(value, "BOOL")
  );
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

function toDynamoEmployeeRecord(employee) {
  if (!employee || typeof employee !== "object") {
    return null;
  }

  if (hasDynamoAttributeValue(employee.id) || hasDynamoAttributeValue(employee.work_email)) {
    return employee;
  }

  const item = {};
  for (const field of EMPLOYEE_STRING_FIELDS) {
    const value = employee[field];
    if (value !== undefined && value !== null) {
      item[field] = { S: String(value) };
    }
  }

  if (employee.enabled !== undefined && employee.enabled !== null) {
    item.enabled = { BOOL: toBoolean(employee.enabled) };
  }

  if (!item.annual_limit && employee.annual_spend_limit !== undefined && employee.annual_spend_limit !== null) {
    item.annual_limit = { S: String(employee.annual_spend_limit) };
  }

  return Object.keys(item).length > 0 ? item : null;
}

function toDynamoConfigValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (hasDynamoAttributeValue(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return { BOOL: value };
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return { BOOL: true };
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return { BOOL: false };
    }
    return { S: value };
  }
  if (typeof value === "number") {
    return { N: String(value) };
  }
  if (typeof value === "object") {
    return { S: JSON.stringify(value) };
  }
  return { S: String(value) };
}

function toDynamoConfigItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const config = {};
  for (const [key, value] of Object.entries(item)) {
    const dynamoValue = toDynamoConfigValue(value);
    if (dynamoValue) {
      config[key] = dynamoValue;
    }
  }
  return config;
}

export class HrisUserSyncClient {
  constructor(config) {
    this.config = config;
  }

  get isConfigured() {
    return Boolean(this.config.baseUrl);
  }

  async lookupEmployeeByEmail(email) {
    return this.lookupEmployee(this.config.emailPath, { email });
  }

  async lookupEmployeeById(id) {
    return this.lookupEmployee(this.config.idPath, { id });
  }

  async lookupEmployeeByPhone(phone, countryCode, shop) {
    return this.lookupEmployee(this.config.phonePath, { phone, countryCode, shop });
  }

  async lookupEmployee(path, params) {
    if (!this.isConfigured) {
      throw new Error("HRIS_USER_SYNC_BASE_URL is required for retail employee routing");
    }

    const response = await axios.get(buildUrl(this.config.baseUrl, path), {
      params,
      timeout: this.config.timeoutMs,
      headers: this.config.token ? { Authorization: `Bearer ${this.config.token}` } : {},
    });

    return toDynamoEmployeeRecord(unwrapEmployee(response.data));
  }

  async getRetailConfig(id) {
    const response = await this.get(`/retail-config/${encodeURIComponent(id)}`);
    return response.data?.item || null;
  }

  async getRetailConfigAsDynamo(id) {
    return toDynamoConfigItem(await this.getRetailConfig(id));
  }

  async getRolePermission(role) {
    const response = await this.get(
      `/retail-config/role-permission/${encodeURIComponent(role)}`
    );
    return toBoolean(response.data?.permission);
  }

  async getAnnualSpendLimit(shopName = "", workerType = "") {
    const response = await this.get("/retail-config/annual-spend-limit", {
      shop: shopName,
      workerType,
    });
    return response.data?.value;
  }

  async getEmployeeOrder(emailId, orderId) {
    const response = await this.get(
      `/employee-orders/${encodeURIComponent(emailId)}/${encodeURIComponent(orderId)}`
    );
    return response.data;
  }

  async listEmployeeOrders(emailId, workerType = "FT") {
    const response = await this.get(`/employee-orders/${encodeURIComponent(emailId)}`, {
      workerType,
    });
    return response.data;
  }

  async get(path, params = {}) {
    if (!this.isConfigured) {
      throw new Error("HRIS_USER_SYNC_BASE_URL is required for retail employee routing");
    }

    return axios.get(buildUrl(this.config.baseUrl, path), {
      params,
      timeout: this.config.timeoutMs,
      headers: this.config.token ? { Authorization: `Bearer ${this.config.token}` } : {},
    });
  }
}
