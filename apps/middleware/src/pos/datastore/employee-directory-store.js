import { isRetailEmployee } from "../helpers/checkRetailEmployee-util.js";
import { getHrisRoutingConfig } from "../helpers/hris-routing-config.js";
import { HrisUserSyncClient } from "../helpers/hris-user-sync-client.js";

function normalizeCallingCode(countryCode) {
  if (!countryCode) {
    return "";
  }

  return `+${String(countryCode).replace(/\s+/g, "").replace(/^\+/, "")}`;
}

function validateEmployeeCountry(item, countryCode) {
  if (!item) {
    return item;
  }

  const storeInfo = item.store?.S || "";
  if (!isRetailEmployee(storeInfo)) {
    return item;
  }

  if (!countryCode) {
    return "Employee is eligible for EDP only in his/her home country";
  }

  const expectedCountryCode = normalizeCallingCode(countryCode);
  const employeeCountryCode = normalizeCallingCode(item.country_code?.S);
  if (item.country_code?.S === expectedCountryCode || employeeCountryCode === expectedCountryCode) {
    return item;
  }

  return "Employee is eligible for EDP only in his/her home country";
}

function formatRoutingError(error) {
  const message = error?.message || String(error);
  const status = error?.response?.status;
  return status ? `${message} (status ${status})` : message;
}

function parseAnnualSpendLimitKey(shopName = "") {
  const normalized = String(shopName || "").replace(/^_+/, "");
  if (!normalized) {
    return { shop: "", workerType: "" };
  }

  const parts = normalized.split("_");
  const maybeWorkerType = parts[parts.length - 1];
  const knownWorkerTypes = new Set(["P", "F", "SL"]);

  if (knownWorkerTypes.has(maybeWorkerType) && parts.length > 1) {
    return {
      shop: parts.slice(0, -1).join("_"),
      workerType: maybeWorkerType,
    };
  }

  return { shop: normalized, workerType: "" };
}

export class EmployeeDirectoryStore {
  constructor(options = { region: process.env.AWS_REGION || "us-east-1" }) {
    this.routingConfig = getHrisRoutingConfig();
    this.hrisClient = new HrisUserSyncClient(this.routingConfig);
  }

  async lookupEmployeeById(id) {
    return this.lookupWithRouting("id", () => this.hrisClient.lookupEmployeeById(id));
  }

  async lookupEmployeeByEmail(email) {
    return this.lookupWithRouting(
      "email",
      () => this.hrisClient.lookupEmployeeByEmail(email)
    );
  }

  async lookupEmployeeByPhone(phone, countryCode, shop) {
    return this.lookupWithRouting(
      "phone",
      async () => validateEmployeeCountry(
        await this.hrisClient.lookupEmployeeByPhone(phone, countryCode, shop),
        countryCode
      )
    );
  }

  async lookupWithRouting(lookupType, hrisLookup) {
    if (!this.routingConfig.enabled) {
      throw new Error("HRIS_USER_SYNC_BASE_URL is required for retail employee lookup");
    }

    try {
      const employee = await hrisLookup();
      console.log(`Employee ${lookupType} lookup routed to alo-retail-hris-user-sync`);
      return employee;
    } catch (error) {
      console.error(
        `Employee ${lookupType} lookup failed in alo-retail-hris-user-sync: ${formatRoutingError(error)}`
      );
      throw error;
    }
  }

  async configWithRouting(configType, hrisLookup) {
    if (!this.routingConfig.enabled) {
      throw new Error("HRIS_USER_SYNC_BASE_URL is required for retail POS config lookup");
    }

    try {
      const config = await hrisLookup();
      console.log(`${configType} routed to alo-retail-hris-user-sync`);
      return config;
    } catch (error) {
      console.error(`${configType} failed in alo-retail-hris-user-sync: ${formatRoutingError(error)}`);
      throw error;
    }
  }

  async isPermitted(role) {
    return this.configWithRouting(
      "role permission",
      () => this.hrisClient.getRolePermission(role)
    );
  }

  async getConfig(id) {
    return this.configWithRouting(
      `retail config ${id}`,
      () => this.hrisClient.getRetailConfigAsDynamo(id)
    );
  }

  async employeeDiscountCode() {
    return this.getConfig("Employee Discount");
  }

  async customerPhoneValidationConfig() {
    return this.getConfig("PhoneNo_Validation_Config");
  }

  async getPreorderCheckConfig() {
    return this.getConfig("Preorder-check-config");
  }

  async getScanDiscountDataConfig() {
    return this.getConfig("ScanDiscount_Config");
  }

  async birthdayToastMessage() {
    return this.getConfig("Birthday_Toast_Config");
  }

  async globalAnnualSpendLimit(shopName) {
    return this.configWithRouting(
      "annual spend limit",
      () => {
        const { shop, workerType } = parseAnnualSpendLimitKey(shopName);
        return this.hrisClient.getAnnualSpendLimit(shop, workerType);
      }
    );
  }

  async getEDPPhoneConfig() {
    return this.configWithRouting(
      "EDP phone config",
      () => this.hrisClient.getRetailConfig("EDP_PhoneNumber_Config")
    );
  }

  async getAloDiscounts(shopName) {
    const config = await this.getConfig(`RESTRICT_DISCOUNTS${shopName}`);
    const discounts = config?.DISCOUNTS?.S || config?.discounts?.S || config?.value?.S;
    if (!discounts) {
      return [];
    }

    return discounts.split(",").map((item) => item.trim()).filter(Boolean);
  }

  async searchDynamoData(searchValue) {
    console.log(`Employee free-text search is HRIS-owned in retail and is not backed by old employee tables: ${searchValue}`);
    return null;
  }
}
