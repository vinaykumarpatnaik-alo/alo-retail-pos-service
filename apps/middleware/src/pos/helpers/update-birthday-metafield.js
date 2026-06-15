import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const UPDATE_BIRTHDAY_METAFIELD_MUTATION = `
  mutation customerUpdateBirthdayMetafield($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        metafields(first: 10, namespace: "facts") {
          edges {
            node {
              namespace
              key
              value
              type
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

function formatBirthdateValue(birthdate) {
  const month = String(birthdate?.month || "").trim().padStart(2, "0");
  const day = String(birthdate?.day || "").trim().padStart(2, "0");
  const year = String(birthdate?.year || "1920").trim();

  if (!month || !day || month === "00" || day === "00") {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export async function updateBirthdayMetafield(session, customerId, birthdate, apiName) {
  const metricName = "customer_update_birthday_metafield";
  const startTime = process.hrtime();
  const client = new shopify.api.clients.Graphql({ session });
  const value = formatBirthdateValue(birthdate);

  if (!value) {
    console.log("Birthday metafield update skipped due to missing month/day");
    return null;
  }

  try {
    const response = await client.request(UPDATE_BIRTHDAY_METAFIELD_MUTATION, {
      variables: {
        input: {
          id: "gid://shopify/Customer/" + customerId,
          metafields: [
            {
              namespace: "facts",
              key: "birth_date",
              type: "date",
              value,
            },
          ],
        },
      },
    });

    return response?.data?.customerUpdate || null;
  } catch (error) {
    console.log("Birthday metafield update failed for customer " + customerId);
    console.error("Error updating birthday metafield", error);
    throw error;
  } finally {
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: apiName });
  }
}
