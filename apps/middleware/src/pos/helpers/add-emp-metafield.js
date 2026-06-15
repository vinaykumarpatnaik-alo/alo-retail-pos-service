import shopify from "../shopify.js";
import isStringEmpty from "./string-empty.js";

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

export default async function customerUpdate(session, customerData) {
  console.log("Add/Update customer metafield");
  console.time("/addmetafield");
  const client = new shopify.api.clients.Graphql({ session }); 
  let response = null;
  let res;
  const emp_validated_date_id = customerData?.emp_validated_date_id;
  //const emp_discount_status_id = customerData?.emp_discount_status_id
  try {
    if(!isStringEmpty(emp_validated_date_id)){ //&& !isStringEmpty(emp_discount_status_id)
      response = await client.request(
        UPDATE_CUSTOMER_MUTATION,
        {
          variables: {
            input: {
              id: "gid://shopify/Customer/" + customerData.id,
              metafields: [
                {
                  id: customerData.emp_validated_date_id.trim(),
                  value: new Date(), // Use ISO string for date values
                },
                // {
                //   id: customerData.emp_discount_status_id.trim(),
                //   value: "true",
                // }
              ],
            },
          }
        }
      );
      
    }else{
      response = await client.request(
        UPDATE_CUSTOMER_MUTATION,
        {
          variables: {
            input: {
              id: "gid://shopify/Customer/" + customerData.id,
              metafields: [
                {
                  key: "employee_validate_date",
                  namespace: "alo",
                  type: "date",
                  value: new Date(), // Format: YYYY-MM-DD
                },
                // {
                //   key: "employee_discount_status",
                //   namespace: "alo",
                //   type: "boolean",
                //   value: true.toString(),
                // }
              ],
            },
          }
        }
      );
    }
    
    res = response.data.customerUpdate;
    console.timeEnd("/addmetafield");
    return res;
  } catch (error) {
    console.error("Error adding metafield", error);
    console.error(res);
    console.timeEnd("/addmetafield");
  }
}
