import shopify from "../shopify.js";

const GET_PRODUCTVARIANT_PRICE = (ProductVariantIdsQry) => `query {
    nodes(ids: ${ProductVariantIdsQry}) {
      ... on ProductVariant {
        id
        price
      }
    }
  }`;

const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
const TIMEOUT_DURATION = timeoutValue ? parseInt(timeoutValue, 10) : 10000;  // 10 (meaning decimal) and 10000 mills
console.log("SHOPIFY_API_TIMEOUT configured = ",TIMEOUT_DURATION);

export default async function getProductPrice(session, ProductVariantIds) {
  console.log("getProductPrice:", ProductVariantIds);
  let ProductVariantIdsQryStr = [];
  for (let variantId of ProductVariantIds) {
    ProductVariantIdsQryStr.push(`gid://shopify/ProductVariant/${variantId}`);
  }
  console.log(
    "getProductPrice ProductVariantIdsQryStr:",
    ProductVariantIdsQryStr
  );
  const client = new shopify.api.clients.Graphql({ session }); 
  let response = null;
  try {
    console.log("getProductPrice :TRY ");
    // Using Promise.race() to add timeout
    response = await Promise.race([
      client.request(GET_PRODUCTVARIANT_PRICE(JSON.stringify(ProductVariantIdsQryStr))),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timed out after 10 seconds')),
          TIMEOUT_DURATION
        )
      )
    ]);
    
    let resultArr = response.data.nodes;
    let productPrices = resultArr?.map((priceItem) => +(priceItem?.price || 0));
    console.log("getProductPrice productPrices:", productPrices);
    return productPrices || [];
  } catch (error) {
    console.log("Error occured while fetching variant pricing data ", error);
    throw error;
  }
}
