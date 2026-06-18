import {DynamoDBClient, GetItemCommand, QueryCommand} from "@aws-sdk/client-dynamodb";
import {configureMiddlewareRuntimeConfig} from "@alo-retail-pos-service/runtime-config";
import {Session} from "@shopify/shopify-api";
import {Elysia} from "elysia";
import jwt from "jsonwebtoken";

import customerGet from "./pos/helpers/get-customer.js";
import customerCreator from "./pos/helpers/customer-create.js";
import customerCreateInternational from "./pos/helpers/customer-create-international.js";
import customerUpdate from "./pos/helpers/edit-customer.js";
import customerEditInternational from "./pos/helpers/customer-edit-international.js";
import customerGetData from "./pos/helpers/get-customer-data.js";
import {setMarketConsent} from "./pos/helpers/create-marketing-consent.js";
import employeeData from "./pos/helpers/employee-data.js";
import featureStatus from "./pos/helpers/feature-status.js";
import getDiscountData from "./pos/helpers/discount-data.js";
import getGift from "./pos/helpers/get-gwp.js";
import getInventoryQuantity from "./pos/helpers/get-inventory-quantity.js";
import getPhoneNumberConfigs from "./pos/helpers/get-edp-phoneNoConfig.js";
import getPreorderCheckConfigs from "./pos/helpers/getPreorderCheckConfigs.js";
import getPreorderVariantDetails from "./pos/helpers/getPreorderVariantDetails.js";
import getScanDiscountData from "./pos/helpers/getScanDiscountData.js";
import getOmniOrders from "./pos/helpers/getOmniOrders.js";
import getSignupConfigs from "./pos/helpers/get-signup-configs.js";
import getStaff from "./pos/helpers/get-staff.js";
import getStoreAddress from "./pos/helpers/get-store-address.js";
import searchCustomers from "./pos/helpers/search-customer.js";
import userData from "./pos/helpers/staff-data.js";
import addMetafield from "./pos/helpers/meta-field-update.js";
import {checkedIfBlocked} from "./pos/helpers/check-customer-blockstatus.js";
import {encodeLocalAuthToken} from "./pos/helpers/generate-local-token.js";
import encodeAuthToken from "./pos/helpers/generate-token.js";
import {
  getInternationalCustomerInput,
  getInternationalCustomerValidationError,
  getUserErrorsMessage,
  parseCustomerLocationValue,
} from "./pos/helpers/international-customer-common.js";
import {formatSanitizeInput} from "./pos/helpers/sanitize-input.js";
import isStringEmpty from "./pos/helpers/string-empty.js";
import {logMetric, hrtimeToMilliseconds} from "./pos/helpers/metric-util.js";
import {processAloAccess, processOnlyGifts} from "./pos/helpers/process-alo-access-data.js";
import {updateAgeRangeMetafield} from "./pos/helpers/update-agerange-metafield.js";
import {updateBirthday} from "./pos/helpers/update-birthday.js";
import {updateBirthdayMetafield} from "./pos/helpers/update-birthday-metafield.js";
import {updateGuestStatusWrapper} from "./pos/helpers/update-guest-status-alo.js";
import {EmployeeDirectoryStore} from "./pos/datastore/employee-directory-store.js";
import {HrisUserSyncClient} from "./pos/helpers/hris-user-sync-client.js";
import {getHrisRoutingConfig} from "./pos/helpers/hris-routing-config.js";

configureMiddlewareRuntimeConfig();

const region = process.env.AWS_REGION || process.env.REGION || "us-east-1";
const dynamodb = new DynamoDBClient({region});
const dynamoStore = new EmployeeDirectoryStore({region});
const hrisClient = new HrisUserSyncClient(getHrisRoutingConfig());

function json(set, status, payload) {
  set.status = status;
  return payload;
}

function success(set, payload, status = 200) {
  return json(set, status, {success: status >= 200 && status < 300, error: null, payload});
}

function failure(set, status, error, payload = undefined) {
  return json(set, status, {
    success: false,
    error: error instanceof Error ? error.message : String(error),
    ...(payload === undefined ? {} : {payload}),
  });
}

function stringValue(value) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value === undefined || value === null ? "" : String(value);
}

function bearerToken(headers) {
  const auth = headers?.authorization || headers?.Authorization || "";
  const value = Array.isArray(auth) ? auth[0] : auth;
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function shopFromToken(token) {
  if (!token) return "";

  let decoded;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (secret) {
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      decoded = jwt.decode(token);
    }
  } else {
    decoded = jwt.decode(token);
  }

  const dest = decoded?.dest || decoded?.iss || decoded?.shop || "";
  if (!dest) return "";
  try {
    return new URL(dest).hostname;
  } catch {
    return String(dest).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

async function loadSessionForShop(shop) {
  const tableName = process.env.SESSION_DATA_TABLE_NAME;
  if (!tableName) {
    throw new Error("SESSION_DATA_TABLE_NAME is required");
  }

  const fromShopIndex = await dynamodb.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "shop-index",
      KeyConditionExpression: "#shop = :shop",
      ExpressionAttributeNames: {"#shop": "shop"},
      ExpressionAttributeValues: {":shop": {S: shop}},
      Limit: 1,
    }),
  ).catch(() => ({Items: []}));

  let item = fromShopIndex.Items?.[0];
  if (!item) {
    const byId = await dynamodb.send(
      new GetItemCommand({
        TableName: tableName,
        Key: {id: {S: `offline_${shop}`}},
      }),
    );
    item = byId.Item;
  }

  if (!item?.accessToken?.S) {
    throw new Error(`Shopify session not found for ${shop}`);
  }

  return new Session({
    id: item.id?.S || `offline_${shop}`,
    shop: item.shop?.S || shop,
    state: item.state?.S || "",
    isOnline: item.isOnline?.BOOL ?? false,
    scope: item.scope?.S || process.env.SCOPES || process.env.SHOPIFY_SCOPES || "",
    accessToken: item.accessToken.S,
  });
}

async function sessionFromContext({headers, query}) {
  const explicitShop = stringValue(query?.shop);
  const shop = explicitShop || shopFromToken(bearerToken(headers));
  if (!shop) {
    throw new Error("Unauthorized: shop could not be resolved from session token");
  }
  return loadSessionForShop(shop);
}

async function withSession(context, handler) {
  const session = await sessionFromContext(context);
  return handler(session);
}

async function updateBirthdayIfNeeded(birthdate, isBdayUpdated, customerId, encodeToken, apiName, session, metafieldBdayUpdate = false) {
  if (!isBdayUpdated) return;
  if (metafieldBdayUpdate) {
    await updateBirthdayMetafield(session, customerId, birthdate, apiName);
    return;
  }
  await updateBirthday(birthdate, customerId, encodeToken, apiName);
}

function userErrorsToString(userErrors = []) {
  return userErrors.map((error) => error?.message).filter(Boolean).toString();
}

export const posRoutes = new Elysia({name: "pos-routes"})
  .post("/pos/v1/local-session-token", ({body, set}) => {
    const {apiKey, apiSecret, storeUrl} = body || {};
    if (!apiKey || !apiSecret || !storeUrl) {
      return failure(set, 400, "apiKey, apiSecret and storeUrl are required");
    }
    return success(set, {token: encodeLocalAuthToken({apiKey, apiSecret, storeUrl}), storeUrl});
  })
  .get("/pos/v1/health", () => ({
    env: process.env.ENV,
    region: process.env.AWS_REGION || process.env.REGION,
  }))
  .get("/pos/v1/employee-orders/:email_id/:order_id", async ({params, set}) => {
    const emailId = stringValue(params.email_id);
    const orderId = stringValue(params.order_id);
    if (isStringEmpty(emailId) || isStringEmpty(orderId)) return failure(set, 400, "email_id and order_id are required");

    try {
      return await hrisClient.getEmployeeOrder(emailId, orderId);
    } catch (error) {
      if (error?.response?.status === 404) return failure(set, 404, "Employee order not found");
      throw error;
    }
  })
  .get("/pos/v1/employee-orders/:email_id", async ({params, query, set}) => {
    const emailId = stringValue(params.email_id);
    if (isStringEmpty(emailId)) return failure(set, 400, "email_id is required");
    return hrisClient.listEmployeeOrders(emailId, stringValue(query.workerType) || "FT");
  })
  .get("/pos/v1/extensions/rewards", async (context) => withSession(context, async (session) => {
    const customerId = stringValue(context.query.customerId);
    if (!customerId) return failure(context.set, 400, "No user id in the requests");
    return success(context.set, await processAloAccess(customerId, session));
  }))
  .get("/pos/v1/customer/gifts", async (context) => withSession(context, async (session) => {
    const customerId = stringValue(context.query.customerId);
    if (!customerId) return failure(context.set, 400, "No user id in the requests");
    return success(context.set, await processOnlyGifts(customerId, session));
  }))
  .get("/pos/v1/extensions/data", async (context) => withSession(context, async (session) => {
    const staffId = stringValue(context.query.staffId);
    if (isStringEmpty(staffId)) return failure(context.set, 500, "Staff id undefined");
    const data = await userData(session, staffId);
    const customerId = stringValue(context.query.customerId);
    if (!isStringEmpty(customerId)) {
      const customerData = await customerGet(session, customerId, "api_extensions_data");
      data.customer_phone = customerData?.phone;
      data.customer_email = customerData?.email;
    }
    return success(context.set, data);
  }))
  .get("/pos/v1/getStaffDetails/data", async (context) => withSession(context, async (session) => {
    const staffId = stringValue(context.query.staffId);
    if (isStringEmpty(staffId)) return failure(context.set, 500, "STAFF_INVALID", {message: "STAFF_INVALID"});
    const {validateStaffAuth} = await import("./pos/helpers/validateStaffAuth.js");
    return success(context.set, await validateStaffAuth(session, staffId));
  }))
  .get("/pos/v1/getAloDiscounts/data", async (context) => withSession(context, async (session) =>
    success(context.set, await getDiscountData(session)),
  ))
  .get("/pos/v1/getdetails/employee", async (context) => withSession(context, async (session) => {
    const email = stringValue(context.query.emailId);
    if (isStringEmpty(email)) return failure(context.set, 500, "email id undefined");
    const data = await employeeData("", email, "", session);
    const status = isStringEmpty(data?.employee?.id) ? 400 : 200;
    return json(context.set, status, {
      success: status === 200,
      error: status === 200 ? null : "Employee not found. Please have employee reach out to their manager/supervisor",
      payload: {...data, is_same_as_pos_user: false},
    });
  }))
  .get("/pos/v1/extensions/customer", async (context) => withSession(context, async (session) => {
    const customerId = stringValue(context.query.id);
    if (isStringEmpty(customerId)) return failure(context.set, 500, "Customer id undefined");
    return success(context.set, await customerGet(session, customerId, "api_extensions_customer"));
  }))
  .get("/pos/v1/extensions/employees", async (context) => withSession(context, async (session) => {
    const phone = stringValue(context.query.phone);
    const staffId = stringValue(context.query.staffId);
    const customerId = stringValue(context.query.customerId);
    const countryCode = stringValue(context.query.countryCode);
    if (isStringEmpty(phone)) return failure(context.set, 500, "Phone id undefined");
    const data = await employeeData(phone.replace(/\D/g, ""), "", countryCode, session);
    let isSameAsPosUser = false;
    let error = data?.error || null;
    if (data?.employee) {
      const staffData = await getStaff(session, staffId);
      const staffEmail = staffData?.email;
      if ((data.employee.personal_email && data.employee.personal_email === staffEmail) || (data.employee.work_email && data.employee.work_email === staffEmail)) {
        isSameAsPosUser = true;
        data.employee.staff_email = staffEmail;
      }
    }
    if (!isStringEmpty(customerId)) {
      await addMetafield(session, customerId, "api_extensions_employee");
    }
    const status = isStringEmpty(data?.employee?.id) ? 400 : 200;
    if (status === 400 && error !== "Employee is eligible for EDP only in his/her home country") {
      error = "Employee not found. Please have employee reach out to their manager/supervisor";
    }
    return json(context.set, status, {success: status === 200, error, payload: {...data, is_same_as_pos_user: isSameAsPosUser}});
  }))
  .post("/pos/v1/extensions/metafield", async (context) => withSession(context, async (session) => {
    const customerId = stringValue(context.query.customerId);
    const dateFromClient = context.body?.date;
    if (isStringEmpty(customerId)) return failure(context.set, 500, "Customer id undefined");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFromClient || "")) return failure(context.set, 500, `Invalid date format from client: ${dateFromClient}`);
    const response = await addMetafield(session, customerId, "api_extensions_metafield", dateFromClient);
    const errors = userErrorsToString(response?.userErrors || []);
    return json(context.set, errors ? 400 : 200, {success: !errors, error: errors || null, payload: "success"});
  }))
  .get("/pos/v1/extensions/feature", async ({query, set}) => success(set, await featureStatus(query.featureName)))
  .post("/pos/v1/log", ({body, set}) => {
    console.log("POS extension log", body);
    return success(set, "success");
  })
  .get("/pos/v1/gwp/data", async (context) => withSession(context, async (session) =>
    success(context.set, await getGift(session, stringValue(context.query.locale))),
  ))
  .get("/pos/v1/store/getOrderDetails", async (context) => withSession(context, async (session) => {
    const locationId = stringValue(context.query.locationId);
    if (!locationId) return failure(context.set, 400, "LocationId is required");
    const data = await getOmniOrders(locationId, context.query.fulfillmentType, context.query.isTransferOrder || false, session);
    return success(context.set, data);
  }))
  .get("/pos/v1/extensions/test", () => ({message: "hello from alo pos apps"}))
  .post("/pos/v1/customer/create", async (context) => withSession(context, async (session) => {
    const body = context.body || {};
    const customerInput = {
      firstName: body.firstName,
      email: body.email,
      phone: body.phone,
      lastName: body.lastName,
      marketingInd: body.marketingInd,
      isLoyaltyOptIn: body.isLoyaltyOptIn,
      type: String(body.type || "").trim(),
      storeName: String(body.store_name || body.storeName || "").trim(),
      locationId: String(body.location_id || body.locationId || "").trim(),
      country: String(body.country || "").trim(),
      city: String(body.city || "").trim(),
    };
    const response = await customerCreator(session, customerInput);
    const errors = userErrorsToString(response?.userErrors || []);
    if (errors) return json(context.set, 500, {success: false, error: errors, payload: undefined});
    const customerId = Number.parseInt(response.customer?.id.replace("gid://shopify/Customer/", ""), 10);
    const token = encodeAuthToken();
    await updateBirthdayIfNeeded(body.birthdate, body.isBdayUpdated, customerId, token, "api_customer_create", session, Boolean(body.metafieldBdayUpdate)).catch(console.error);
    if (body.ageRange) updateAgeRangeMetafield(session, customerId, body.ageRange, "api_customer_create").catch(console.error);
    if (body.isLoyaltyOptIn) updateGuestStatusWrapper(customerId, body.email, customerInput.isLoyaltyOptIn, "api_customer_create");
    return success(context.set, customerId);
  }))
  .post("/pos/v1/customer/create/international", async (context) => withSession(context, async (session) => {
    const body = context.body || {};
    const customerInput = getInternationalCustomerInput(body);
    const validationError = getInternationalCustomerValidationError(customerInput);
    if (validationError) return failure(context.set, 400, validationError);
    const response = await customerCreateInternational(session, customerInput);
    const errors = getUserErrorsMessage(response?.userErrors || []);
    if (errors) return failure(context.set, 500, errors);
    const customerId = Number.parseInt(response.customer?.id.replace("gid://shopify/Customer/", ""), 10);
    await updateBirthdayIfNeeded(body.birthdate, body.isBdayUpdated, customerId, encodeAuthToken(), "api_customer_create_international", session).catch(console.error);
    return success(context.set, customerId);
  }))
  .post("/pos/v1/customer/edit", async (context) => withSession(context, async (session) => {
    const body = context.body || {};
    const userId = stringValue(context.query.customerId);
    const marketingIndData = body.email ? body.marketingInd : false;
    const customerInput = {
      id: userId,
      firstName: body.firstName,
      email: body.email,
      phone: body.phone,
      lastName: body.lastName,
      marketingInd: marketingIndData,
      updateEnrolldate: body.updateEnrolldate,
      isLoyaltyOptIn: body.isLoyaltyOptIn,
      type: String(body.type || "").trim(),
      storeName: String(body.store_name || body.storeName || "").trim(),
      locationId: String(body.location_id || body.locationId || "").trim(),
      country: String(body.country || "").trim(),
      city: String(body.city || "").trim(),
    };
    const response = await customerUpdate(session, customerInput);
    const errors = userErrorsToString(response?.userErrors || []);
    if (errors) return failure(context.set, 500, errors);
    await updateBirthdayIfNeeded(body.birthdate, body.isBdayUpdated, userId, encodeAuthToken(), "api_customer_edit", session, Boolean(body.metafieldBdayUpdate)).catch(console.error);
    if (body.ageRange) updateAgeRangeMetafield(session, userId, body.ageRange, "api_customer_create").catch(console.error);
    if (body.isMarketingIndUpdated) setMarketConsent(session, {customerId: userId, marketingInd: marketingIndData});
    if (customerInput.isLoyaltyOptIn) updateGuestStatusWrapper(userId, body.email, customerInput.isLoyaltyOptIn, "api_customer_edit");
    return success(context.set, userId);
  }))
  .post("/pos/v1/customer/edit/international", async (context) => withSession(context, async (session) => {
    const body = context.body || {};
    const userId = stringValue(context.query.customerId);
    const customerInput = getInternationalCustomerInput(body, userId);
    const validationError = getInternationalCustomerValidationError(customerInput);
    if (validationError) return failure(context.set, 400, validationError);
    const response = await customerEditInternational(session, customerInput);
    const errors = getUserErrorsMessage(response?.userErrors || []);
    if (errors) return failure(context.set, 500, errors);
    await updateBirthdayIfNeeded(body.birthdate, body.isBdayUpdated, userId, encodeAuthToken(), "api_customer_edit_international", session, Boolean(body.metafieldBdayUpdate)).catch(console.error);
    return success(context.set, userId);
  }))
  .get("/pos/v1/customer/getdata", async (context) => withSession(context, async (session) => {
    const userId = stringValue(context.query.customerId);
    if (isStringEmpty(userId)) return failure(context.set, 500, "Customer id undefined");
    const [birthdayCfgItem, phoneCfgItem, customerInfo] = await Promise.all([
      dynamoStore.birthdayToastMessage(),
      dynamoStore.customerPhoneValidationConfig(),
      customerGetData(session, userId, "api_customer_getdata"),
    ]);
    const loyaltyInfoMap = new Map();
    for (const edge of customerInfo?.facts?.edges || []) {
      if (edge.node.key === "birth_date") loyaltyInfoMap.set("birthday", edge.node.value);
    }
    let updateEnrolldate = false;
    for (const edge of customerInfo?.loyalty?.edges || []) {
      loyaltyInfoMap.set(edge.node.key, edge.node.type === "number_integer" ? Number.parseInt(edge.node.value, 10) : edge.node.value);
      if (edge.node.key === "birthday" && edge.node.value) loyaltyInfoMap.set("birthday", edge.node.value);
      if (edge.node.key === "enroll_date") updateEnrolldate = edge.node.value === null;
    }
    if (!customerInfo?.loyalty?.edges?.length || !(customerInfo.loyalty.edges || []).some((edge) => edge.node.key === "enroll_date")) {
      updateEnrolldate = true;
    }
    const marketingConsent = customerInfo?.emailMarketingConsent?.marketingState?.localeCompare("subscribed", undefined, {sensitivity: "accent"}) === 0;
    const blockedStatus = customerInfo?.email ? (await checkedIfBlocked(customerInfo.email)) || false : false;
    return success(context.set, {
      firstName: customerInfo?.firstName || " ",
      lastName: customerInfo?.lastName || "",
      email: customerInfo?.email || "",
      phone: customerInfo?.phone || "",
      id: customerInfo?.id.replace("gid://shopify/Customer/", "") || "",
      marketingInd: marketingConsent,
      loyaltyInd: true,
      loyaltyInfo: Object.fromEntries(loyaltyInfoMap),
      gifts: null,
      updateEnrolldate,
      blockedStatus,
      phoneValidationConfig: {
        message: phoneCfgItem?.message ?? "Phone Number Not Found on Customer Profile",
        timer: phoneCfgItem?.timer,
        showMessage: phoneCfgItem?.showMessage,
      },
      birthdayToastConfig: {showMessage: birthdayCfgItem?.showMessage ?? false},
      location: customerInfo?.customerLocation?.value || "",
      locationInfo: parseCustomerLocationValue(customerInfo?.customerLocation?.value || ""),
      birthDate: customerInfo?.customerBirthDate?.value || "",
    });
  }))
  .get("/pos/v1/inventory/quantity", async (context) => withSession(context, async (session) => {
    const variantId = Number(context.query.variantId);
    const locationId = Number(context.query.locationId);
    if (!Number.isFinite(variantId) || !Number.isFinite(locationId)) return failure(context.set, 400, "Invalid variantId or locationId");
    const response = await getInventoryQuantity(session, variantId, "api_inventory_quantity");
    const levels = response?.data?.productVariant?.inventoryItem?.inventoryLevels?.edges || [];
    const locationNode = levels.find((node) => node.node.location.id === `gid://shopify/Location/${locationId}`);
    const availableQuantity = locationNode ? locationNode.node.quantities.find((quantity) => quantity.name === "available")?.quantity : "Location or data not found";
    return success(context.set, {availableQuantity});
  }))
  .get("/pos/v1/store/address", async (context) => withSession(context, async (session) => {
    const locationId = Number(context.query.locationId);
    if (!Number.isFinite(locationId)) return failure(context.set, 400, "Invalid locationId");
    const data = await getStoreAddress(session, locationId, "api_store_address");
    return data ? success(context.set, data) : failure(context.set, 404, "Store location not found");
  }))
  .post("/pos/v1/customer/search", async (context) => withSession(context, async (session) => {
    const customers = await searchCustomers(session, context.body?.searchString, "api_customer_search");
    return json(context.set, 200, {success: true, customers});
  }))
  .get("/pos/v1/edp/phoneNumberConfigs", async (context) => withSession(context, async (session) =>
    success(context.set, await getPhoneNumberConfigs(session)),
  ))
  .get("/pos/v1/preorder/preorderCheckConfigs", async (context) => withSession(context, async (session) =>
    success(context.set, await getPreorderCheckConfigs(session)),
  ))
  .get("/pos/v1/scanner/scannerDiscount", async (context) => withSession(context, async (session) =>
    success(context.set, await getScanDiscountData(session)),
  ))
  .get("/pos/v1/signup/configs", async (context) => withSession(context, async (session) =>
    success(context.set, await getSignupConfigs(session)),
  ))
  .get("/pos/v1/preorder/variant-details", async (context) => withSession(context, async (session) => {
    const variantId = stringValue(context.query.variantId).trim();
    if (!variantId) return failure(context.set, 400, "variantId not provided");
    return success(context.set, await getPreorderVariantDetails(session, variantId, stringValue(context.query.namespace) || "preorder", context.query.useSearch === "1" || String(context.query.useSearch).toLowerCase() === "true"));
  }));
