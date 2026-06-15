import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";
import {
  buildInternationalLocationMetafield,
  executeWithTimeout,
} from "./international-customer-common.js";

const UPDATE_INTERNATIONAL_CUSTOMER_MUTATION = `
    mutation customerUpdateInternational($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer {
          id
          firstName
          lastName
          phone
          email
          metafields(first: 1) {
            edges {
              node {
                namespace
                key
                value
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
`;

const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
const TIMEOUT_DURATION = timeoutValue ? parseInt(timeoutValue, 10) : 10000;
console.log("SHOPIFY_API_TIMEOUT configured = ", TIMEOUT_DURATION);

export default async function customerEditInternational(session, customerData) {
  const metricName = "update_customer_international_ql";
  const startTime = process.hrtime();
  const timeVar = "/graphql/updatecustomerinternational";
  console.time(timeVar);
  console.log("customer - update international function");
  const client = new shopify.api.clients.Graphql({ session });
  let response = null;

  try {
    response = await executeWithTimeout(
      client.request(UPDATE_INTERNATIONAL_CUSTOMER_MUTATION, {
        variables: {
          input: {
            id: "gid://shopify/Customer/" + customerData.id,
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            phone: customerData.phone,
            email: customerData.email,
            metafields: [buildInternationalLocationMetafield(customerData)],
          },
        },
      }),
      TIMEOUT_DURATION,
      `Operation timed out after ${TIMEOUT_DURATION}ms`
    );

    console.log("Query Extension ", response.extensions);
    console.timeEnd(timeVar);
    console.log("customer update international", JSON.stringify(response.data.customerUpdate));
    return response.data.customerUpdate;
  } catch (error) {
    console.log("error updating international customer", error);
    console.timeEnd(timeVar);
    throw error;
  } finally {
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_customer_edit_international" });
  }
}
