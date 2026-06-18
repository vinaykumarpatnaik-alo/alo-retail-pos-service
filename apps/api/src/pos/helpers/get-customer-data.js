import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";
const GET_CUSTOMER_QYERY = (userId) => `query {
  customer (id: "gid://shopify/Customer/${userId}") {
    id
    email
    firstName
    lastName
    phone
    tags
    emailMarketingConsent {
      marketingState
    }
    loyalty: metafields(first:250, namespace: "loyaltylion") {
      edges {
        node {
          key
          value
          type
        }
      }
    }
    facts: metafields(first:250, namespace: "facts") {
      edges {
        node {
          key
          value
          type
        }
      }
    }
    customerLocation: metafield(namespace: "customer", key: "location") {
      key
      value
      type
    }
    customerBirthDate: metafield(namespace: "facts", key: "birth_date") {
      key
      value
      type
    }
  }
}`;

const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
const TIMEOUT_DURATION = timeoutValue ? parseInt(timeoutValue, 10) : 10000;  // 10 (meaning decimal) and 10000 mills
console.log("SHOPIFY_API_TIMEOUT configured = ",TIMEOUT_DURATION);
// Helper function that rejects after a certain time
const timeout = (ms) => new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`Get customer timed out after ${ms}ms`)), ms)
);

export default async function customerGetData(session, userId, api_name) {
  const metricName = "get_customer_full_ql";
  const startTime = process.hrtime();
  console.log("customer - get function");
  const client = new shopify.api.clients.Graphql({ session }); 
  let response = null;

  try {
    const queryPromise = client.request(GET_CUSTOMER_QYERY(userId));
    response = await Promise.race([
      queryPromise,
      timeout(TIMEOUT_DURATION)
    ]);

    return response.data.customer;
  } catch (error) {
    console.log("error retrieving customer ",userId, error);
  } finally {
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: api_name });
  }
}
