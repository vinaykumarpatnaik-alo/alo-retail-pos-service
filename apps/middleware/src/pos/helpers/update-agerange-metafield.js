import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const UPDATE_AGE_RANGE_METAFIELD_MUTATION = `
  mutation customerUpdateAgeRangeMetafield($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        metafields(first: 10, namespace: "customer") {
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
  const month = String(birthdate?.month || "")
    .trim()
    .padStart(2, "0");
  const day = String(birthdate?.day || "")
    .trim()
    .padStart(2, "0");
  const year = String(birthdate?.year || "1920").trim();

  if (!month || !day || month === "00" || day === "00") {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export async function updateAgeRangeMetafield(
  session,
  customerId,
  ageRange,
  apiName,
) {
  const metricName = "customer_update_agerange_metafield";
  const startTime = process.hrtime();
  const client = new shopify.api.clients.Graphql({ session });

  try {
    const response = await client.request(UPDATE_AGE_RANGE_METAFIELD_MUTATION, {
      variables: {
        input: {
          id: "gid://shopify/Customer/" + customerId,
          metafields: [
            {
              namespace: "customer",
              key: "age_range",
              type: "single_line_text_field",
              value: ageRange,
            },
          ],
        },
      },
    });

    return response?.data?.customerUpdate || null;
  } catch (error) {
    console.error("Error updating age range metafield", error);
    throw error;
  } finally {
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: apiName });
  }
}