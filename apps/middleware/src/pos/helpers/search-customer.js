import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const SEARCH_CUSTOMER_QUERY = `query ($query: String!) {
    customers(first: 100, query: $query) {
      edges {
        node {
          id
          email
          firstName
          lastName
          phone
        }
      }
    }
  }`;

export default async function searchCustomers(session, searchString, api_name) {
  const metricName = "search_customer_min_ql";
  const startTime = process.hrtime();
  const client = new shopify.api.clients.Graphql({ session });
  let response = null;
  const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), timeoutValue)
  );

  try {
    response = await Promise.race([
      client.request(SEARCH_CUSTOMER_QUERY, { variables: { query: searchString } }),
      timeout
    ]);
    
    const customers = response.data.customers.edges.map(edge => edge.node);
    
    console.log(`Returning ${customers.length} customers for search string: ${searchString}`);
    const res_payload = customers.map(customer => ({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone
    }));
    return res_payload;
  } catch (error) {
    console.log("Customer search failed for search string: " + searchString);
    console.error("Error searching customers", error);
  } finally {
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: api_name });
  }
}
