import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const GET_CUSTOMER_QYERY = (userId) => `query {
  customer (id: "gid://shopify/Customer/${userId}") {
    id
    email
    firstName
    lastName
    phone
    alo: metafields(first:1, namespace: "alo") {
      edges {
        node {
          id
          key
          value
          type
        }
      }
    }
  }
}`;

export default async function customerGet(session, userId, api_name) {
  const metricName = "get_customer_min_ql";
  const startTime = process.hrtime();
  const client = new shopify.api.clients.Graphql({ session });
  let response = null;

  try {
    response = await client.request(GET_CUSTOMER_QYERY(userId));

    const res_payload = response.data.customer
    console.log(`Returning the customer data for ${userId}`)
    if (res_payload?.phone) {
      console.log(`Customer ${userId} has phone record`);
    } else {
      console.log(`Customer ${userId} has *NO* phone record`);
    }
    const metafields = res_payload?.alo?.edges;
    let metaid;
    //let statusMetaId;
    if (metafields) {
      const employeeValidateMetafield = metafields.find(
        (edge) => edge.node.key.toLowerCase() === "employee_validate_date"
      );
      // const discoutMetafield = metafields.find(
      //   (edge) => edge.node.key.toLowerCase() === "employee_discount_status"
      // );

      if (employeeValidateMetafield) {
        metaid = employeeValidateMetafield.node.id;
      }

      // if (discoutMetafield) {
      //   statusMetaId = discoutMetafield.node.id;
      // }
      //console.log(`${userId} has metafields for employee date ${metaid} and status ${statusMetaId}`)
      console.log(`Metainfo ${userId} has metafields true for employee date ${metaid}`);
    }else{
      console.log(`Metainfo ${userId} has metafields false employee date`);
    }
    return res_payload;
  } catch (error) {
    console.log("Customer lookup failed " + userId)
    console.error("Error getting customer", error);
  }finally{
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: api_name });
  }
}
