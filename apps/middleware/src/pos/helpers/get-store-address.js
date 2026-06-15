import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const GET_STORE_ADDRESS_QUERY = (locationId) => `query {
  location(id: "gid://shopify/Location/${locationId}") {
    id
    name
    address {
      address1
      address2
      city
      province
      provinceCode
      zip
      country
      countryCode
      phone
      formatted
    }
  }
}`;

export default async function getStoreAddress(session, locationId, apiName) {
  const metricName = "api_store_address";
  const startTime = process.hrtime();
  const client = new shopify.api.clients.Graphql({ session });
  let response = null;

  const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
  const timeoutMs = timeoutValue ? parseInt(timeoutValue, 10) : 10000;
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Store address request timed out")), timeoutMs)
  );

  try {
    response = await Promise.race([
      client.request(GET_STORE_ADDRESS_QUERY(locationId)),
      timeout,
    ]);

    return response?.data?.location || null;
  } catch (error) {
    console.log("Store address lookup failed " + locationId);
    console.error("Error getting store address", error);
    throw error;
  } finally {
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: apiName });
  }
}
