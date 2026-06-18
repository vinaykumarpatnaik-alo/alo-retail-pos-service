export function getInternationalCustomerInput(body, customerId = null) {
  const customerInput = {
    firstName: body.firstName,
    email: body.email,
    phone: body.phone,
    lastName: body.lastName,
    country: String(body.country || "").trim(),
    city: String(body.city || "").trim(),
    type: String(body.type || "").trim(),
    storeName: String(body.store_name || body.storeName || "").trim(),
    locationId: String(body.location_id || body.locationId || "").trim(),
  };

  if (customerId !== null && customerId !== undefined) {
    customerInput.id = customerId;
  }

  return customerInput;
}

export function getInternationalCustomerValidationError(customerData) {
  if (!customerData.country) {
    return "country and city are required";
  }

  return null;
}

export function buildInternationalLocationMetafield(customerData) {
  const locationValue = {
    type: String(customerData?.type || "").trim(),
    store_name: String(customerData?.storeName || customerData?.store_name || "").trim(),
    location_id: String(customerData?.locationId || customerData?.location_id || "").trim(),
    City: String(customerData?.city || "").trim(),
    Country: String(customerData?.country || "").trim(),
  };

  return {
    key: "location",
    namespace: "customer",
    type: "json",
    value: JSON.stringify(locationValue),
  };
}

export function parseCustomerLocationValue(locationValue) {
  if (!locationValue) {
    return { type: "", store_name: "", location_id: "", City: "", Country: "" };
  }

  try {
    const parsed = JSON.parse(locationValue);
    if (parsed && typeof parsed === "object") {
      return {
        type: String(parsed.type || "").trim(),
        store_name: String(parsed.store_name || "").trim(),
        location_id: String(parsed.location_id || "").trim(),
        City: String(parsed.City || "").trim(),
        Country: String(parsed.Country || "").trim(),
      };
    }
  } catch (error) {
    const parts = String(locationValue).split(",").map((value) => value.trim());
    return {
      type: "",
      store_name: "",
      location_id: "",
      City: parts[1] || "",
      Country: parts[0] || "",
    };
  }

  return { type: "", store_name: "", location_id: "", City: "", Country: "" };
}

export function getUserErrorsMessage(userErrors = []) {
  return userErrors.map((error) => error?.message).filter(Boolean).toString();
}

export async function executeWithTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    }),
  ]);
}
