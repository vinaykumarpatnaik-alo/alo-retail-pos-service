import shopify from "../shopify.js";
import util from 'util';
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const CREATE_MARKETING_MUTATION = `
    mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
        customerEmailMarketingConsentUpdate(input: $input) {
            customer {
                id,
                emailMarketingConsent {
                    marketingState,
                    consentUpdatedAt,
                    marketingOptInLevel,
                },
            }
            userErrors { field, message }
        }
    }
`;
const timeoutValue = 10000;//process.env.SHOPIFY_API_TIMEOUT; // changing this to 10000
const TIMEOUT_DURATION = timeoutValue ? parseInt(timeoutValue, 10) : 10000;  // 10 (meaning decimal) and 10000 mills
console.log("SHOPIFY_API_TIMEOUT configured = ",TIMEOUT_DURATION);
// Helper function that rejects after a certain time
const timeout = (ms) => new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`Marketing Consent Update timed out after ${ms}ms`)), ms)
);

export default async function customerMarketingConsent(session, customerData) {
  const metricName = "update_marketingconsent_ql";
  const startTime = process.hrtime();

  const time_var = "/graphql/updatemarketingconsent";
  console.log("customer marketing consent function", customerData);
  console.time(time_var);
  const globalCustomerId = `gid://shopify/Customer/${customerData?.customerId}`;
  console.log("global customerid:", globalCustomerId);
  let newData;
  if (customerData?.marketingInd) {
    console.log("if marketing ind:", customerData?.marketingInd);
    newData = {
      customerId: globalCustomerId,
      emailMarketingConsent: {
        marketingOptInLevel: "SINGLE_OPT_IN",
        marketingState: "SUBSCRIBED",
      },
    };
  } else {
    console.log("else marketing ind:", customerData?.marketingInd);
    newData = {
      customerId: globalCustomerId,
      emailMarketingConsent: {
        marketingOptInLevel: "SINGLE_OPT_IN",
        marketingState: "UNSUBSCRIBED",
      },
    };
  }
  const client = new shopify.api.clients.Graphql({ session });
  let response = null;
  try {
    const mutationPromise = client.request(
      CREATE_MARKETING_MUTATION,
      {
        variables: {
          input: {
            ...newData,
          },
        }
      }
    );
    
    response = await Promise.race([
      mutationPromise,
      timeout(TIMEOUT_DURATION)
    ]);

    console.log("Success updating marketing consent for customer");
    console.timeEnd(time_var);
    return response.data.customerEmailMarketingConsentUpdate;
  } catch (error) {
    console.error(util.format("Error updating market consent customer for customer id : %s", customerData?.customerId), error);
    console.timeEnd(time_var);
    throw error;
  }finally{
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_customer_edit" });

  }
}

export async function setMarketConsent(session, customerData) {
  let customer1;
  try {
    customer1 = await customerMarketingConsent(session, customerData);
    console.log("customer update for marketing consent:", customer1);
  } catch (e) {
    console.log(`Failed to process marketing consent: ${e.message}`);
  }
}