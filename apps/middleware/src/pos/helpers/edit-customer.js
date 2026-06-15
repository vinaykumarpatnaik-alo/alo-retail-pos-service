import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";
import { buildInternationalLocationMetafield } from "./international-customer-common.js";

const UPDATE_CUSTOMER_MUTATION = `
    mutation customerUpdate($input: CustomerInput!) {
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
const TIMEOUT_DURATION = timeoutValue ? parseInt(timeoutValue, 10) : 10000;  // 10 (meaning decimal) and 10000 mills
console.log("SHOPIFY_API_TIMEOUT configured = ", TIMEOUT_DURATION);

export default async function customerUpdate(session, customerData) {
  console.log('editsession', JSON.stringify(session))
  console.log('customerData', JSON.stringify(customerData))
  const metricName = "update_customer_ql";
  const startTime = process.hrtime();
  const time_var = "/graphql/updatecustomer"
  console.log("customer - update function");
  console.time(time_var);
  const client = new shopify.api.clients.Graphql({ session });
  let response = null;
  const metafields = [];

  //set the enroll date to Jan 1, 2023 for customer's without enroll date.
  const ENROLL_DATE = 2023;

  // Helper function that rejects after a certain time
  const timeout = (ms) => new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  );

  try {
    if (customerData?.isLoyaltyOptIn) {
      metafields.push({
        key: "enroll_date",
        namespace: "loyaltylion",
        type: "single_line_text_field",
        value: new Date(Date.UTC(ENROLL_DATE)).toISOString(),
      });
    }

    if (customerData?.type) {
      metafields.push(buildInternationalLocationMetafield(customerData));
    }

    const customerInput = {
      id: "gid://shopify/Customer/" + customerData.id,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      phone: customerData.phone,
      email: customerData.email,
      ...(metafields.length > 0 ? { metafields } : {}),
    };

    const query = client.request(
      UPDATE_CUSTOMER_MUTATION,
      {
        variables: {
          input: customerInput,
        },
      }
    );

    response = await Promise.race([
      query,
      timeout(TIMEOUT_DURATION)
    ]);

    console.log("Query Extension ", response.extensions);
    console.timeEnd(time_var);
    console.log('customerupdate', JSON.stringify(response.data.customerUpdate))
    return response.data.customerUpdate;
  } catch (error) {
    console.log("error updating customer", error);
    console.timeEnd(time_var);
    throw error;
  } finally {
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_customer_edit" });
  }
}
