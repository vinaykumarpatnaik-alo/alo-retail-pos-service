import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const GET_INVENTORYQUANTITY_QYERY = (variantId) => `query {
    productVariant (id:"gid://shopify/ProductVariant/${variantId}") {
        title
        displayName
        createdAt
        price
        compareAtPrice
        inventoryQuantity
        availableForSale
        sku
        inventoryItem{
            inventoryLevels(first:250) {
                edges {
                    node {
                        location {
                            id
                            name
                        }
                        quantities(names: ["on_hand", "available", "committed"]) {
                            name
                            quantity
                        }
                    }
                }
            }
        }
    }
}`;

export default async function getInventoryQuantity(session, variantId, api_name) {
  const metricName = "api_inventory_quantity";
  const startTime = process.hrtime();
  const isShopUS = session.shop.toLowerCase().includes('alo-yoga') || session.shop.toLowerCase().includes('dev2aloyoga');
  if (isShopUS) {
    session = {
      ...session,
      accessToken: process.env.ALO_INVENTORY_TOKEN
    }
  }
  const client = new shopify.api.clients.Graphql({ session });
  let response = null;
  console.log('session', session);
  console.log('variantId', variantId);
  console.log('typevariantId', typeof variantId);
  const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), timeoutValue)
  );

  try {
    response = await Promise.race([
      client.request(GET_INVENTORYQUANTITY_QYERY(variantId)),
      timeout
    ]);
    
    const res_payload = response;
    console.log('res_payload', res_payload);
    return res_payload;
  } catch (error) {
    console.log("Inventory lookup failed " + variantId);
    console.error("Error getting Inventory Details", error);
  } finally {
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: api_name });
  }
}
