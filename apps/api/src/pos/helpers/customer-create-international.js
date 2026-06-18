import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";
import {
  buildInternationalLocationMetafield,
  executeWithTimeout,
} from "./international-customer-common.js";

const CREATE_INTERNATIONAL_CUSTOMER_MUTATION = `
    mutation customerCreateInternational($input: CustomerInput!) {
        customerCreate(input: $input) {
            userErrors {
              field
              message
            }
            customer {
              id,
              firstName,
              lastName,
              phone,
              email,
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
        }
    }
`;

export default async function customerCreateInternational(session, customerData) {
  const metricName = "customer_create_international_ql";
  const startTime = process.hrtime();
  const timeVar = "/graphql/createcustomerinternational";
  console.time(timeVar);
  console.log("customer - create international function");
  const client = new shopify.api.clients.Graphql({ session });
  let response = null;

  try {
    const graphqlRequestPromise = client.request(CREATE_INTERNATIONAL_CUSTOMER_MUTATION, {
      variables: {
        input: {
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          phone: customerData.phone,
          email: customerData.email,
          metafields: [buildInternationalLocationMetafield(customerData)],
        },
      },
    });

    const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
    const timeout = timeoutValue ? parseInt(timeoutValue, 10) : 10000;
    console.log("SHOPIFY_API_TIMEOUT configured = ", timeout);
    response = await executeWithTimeout(
      graphqlRequestPromise,
      timeout,
      "International customer create request timed out"
    );
    console.log("Query Extension ", response.extensions);
    console.timeEnd(timeVar);
    return response.data.customerCreate;
  } catch (error) {
    console.log("error creating international customer", error);
    console.timeEnd(timeVar);
    throw error;
  } finally {
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_customer_create_international" });
  }
}
