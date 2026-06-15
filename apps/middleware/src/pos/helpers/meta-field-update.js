import shopify from "../shopify.js";
import isStringEmpty from "./string-empty.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const UPDATE_CUSTOMER_MUTATION = `
    mutation customerUpdate($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer {
          id
          metafields(first: 1) {
            edges {
              node {
                id
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

export default async function addMetafield(session, userId, api_name,dateStr) {
  const metricName = "add_metafield_emp";
  const startTime = process.hrtime();
  console.log(`GRAPHQL ${userId}`);
  const client = new shopify.api.clients.Graphql({ session });
  let result = null;
  let metaid = null;
  try {

    const get_response = await client.request(GET_CUSTOMER_QYERY(userId));
    const res_payload = get_response.data.customer
    if(res_payload){
        const metafields = res_payload?.alo?.edges;
        if (metafields) {
            const employeeValidateMetafield = metafields.find(
                (edge) => edge.node.key.toLowerCase() === "employee_validate_date"
            );
            metaid = employeeValidateMetafield?.node?.id;
            if(metaid !== null && metaid !== undefined){
              console.log(`Metainfo ${userId} has metafields true for employee date ${metaid}`);
            }else{
              console.log(`Metainfo ${userId} has no metafields`);
            }
            

        }else{
            console.log(`Metainfo ${userId} has metafields false employee date`);
        }
    }else{
        console.log("No customer data found while updating " + userId)
    }
    if(!isStringEmpty(metaid)){
        const update_response = await client.request(
          UPDATE_CUSTOMER_MUTATION,
          {
            variables: {
              input: {
                id: "gid://shopify/Customer/" + userId,
                metafields: [
                  {
                    id: metaid.trim(),
                    value: dateStr
                  }
                ],
              },
            }
          }
        );
        result = update_response.data.customerUpdate;
      }else{
        const update_response = await client.request(
          UPDATE_CUSTOMER_MUTATION,
          {
            variables: {
              input: {
                id: "gid://shopify/Customer/" + userId,
                metafields: [
                  {
                    key: "employee_validate_date",
                    namespace: "alo",
                    type: "date",
                    value: dateStr // YYYY-MM-DD format
                  }
                ],
              },
            }
          }
        );        
        result = update_response.data.customerUpdate;
      }
  } catch (error) {
    console.log("Adding metafield failed for customer " + userId)
    console.error("Error adding metafield", error);
    console.error(res);

  }finally{
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: api_name });
    return result;
  }
}
