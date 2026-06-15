import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";
import { buildInternationalLocationMetafield } from "./international-customer-common.js";

const CREATE_CUSTOMER_MUTATION = `
    mutation customerCreate($input: CustomerInput!) {
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
              emailMarketingConsent {
                marketingState,
                consentUpdatedAt,
                marketingOptInLevel,
              },
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

export default async function customerCreator(session, customerData) {
  const metricName = "customer_create_ql";
  const startTime = process.hrtime();
  const time_var = "/graphql/updatecustomer"
  console.time(time_var);
  console.log("customer - create function");
  const client = new shopify.api.clients.Graphql({ session }); 
  let response = null;
  let marketingData = null;
  const metafields = [];
  //set the enroll date to Jan 1, 2023 for customer's without enroll date.
  const ENROLL_DATE = 2023;
  try {
    if (customerData?.marketingInd) {
      console.log("if marketing ind:", customerData?.marketingInd);
      marketingData = {
        emailMarketingConsent: {
          marketingOptInLevel: "SINGLE_OPT_IN",
          marketingState: "SUBSCRIBED",
        },
      };
    } else {
      console.log("else marketing ind:", customerData?.marketingInd);
      marketingData = {
        emailMarketingConsent: {
          marketingOptInLevel: "SINGLE_OPT_IN",
          marketingState: "UNSUBSCRIBED",
        },
      };
    }
    let enrolDateProp = null;
    if (customerData?.isLoyaltyOptIn) {
      enrolDateProp = {
        key: "enroll_date",
        namespace: "loyaltylion",
        type: "single_line_text_field",
        value: new Date(Date.UTC(ENROLL_DATE)).toISOString(),
      };
      metafields.push(enrolDateProp);
    }

    if (customerData?.type) {
      metafields.push(buildInternationalLocationMetafield(customerData));
    }
    // Create a promise that resolves when the GraphQL request is completed
    const customerInput = {
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      phone: customerData.phone,
      email: customerData.email,
      ...marketingData,
      ...(metafields.length > 0 ? { metafields } : {}),
    };

    const graphqlRequestPromise = client.request(
      CREATE_CUSTOMER_MUTATION,
      {
        variables: {
          input: customerInput,
        }
      }
    );
    
    // Use Promise.race() to wait for the GraphQL request or a timeout
    const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
    const timeout = timeoutValue ? parseInt(timeoutValue, 10) : 10000;  // 10 (meaning decimal) and 10000 mills
    console.log("SHOPIFY_API_TIMEOUT configured = ",timeout);
    response = await Promise.race([
      graphqlRequestPromise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Customer Create request timed out"));
        }, timeout);
      }),
    ]);
    console.log("Query Extension ", response.extensions);
    console.timeEnd(time_var);
    return response.data.customerCreate;
  } catch (error) {
    console.log("error creating customer", error);
    console.timeEnd(time_var);
    throw error;
  }finally{
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_customer_create" });
  }
}
