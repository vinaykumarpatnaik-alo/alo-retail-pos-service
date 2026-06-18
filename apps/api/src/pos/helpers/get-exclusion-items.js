
import shopify from "../shopify.js";
import {keyFromEdges, parseGid} from '@shopify/admin-graphql-api-utilities';
import { DynamoDBExclusionStorage } from "../datastore/exclusionstore.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";
const GET_EXCLUSION_BY_HANDLE = `query {
  collectionByHandle(handle: "point-restrictions") {
    id
    title
    products(first: 50) {
      edges {
        node {
          id
        }
      }
    }
  }
}`;

const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
const TIMEOUT_DURATION = timeoutValue ? parseInt(timeoutValue, 10) : 10000;  // 10 (meaning decimal) and 10000 mills
console.log("SHOPIFY_API_TIMEOUT configured = ",TIMEOUT_DURATION);

const exclusionList = async (session) =>{
  const client = new shopify.api.clients.Graphql({ session }); 
  // Using Promise.race() to add timeout
  const response = await Promise.race([
    client.request(GET_EXCLUSION_BY_HANDLE),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Request timed out after 10 seconds')),
        TIMEOUT_DURATION
      )
    )
  ]);

  const productIds = keyFromEdges(response.data?.collectionByHandle?.products?.edges,
    "id").map((str) => parseGid(str) ) ;
  console.log("------- Retrieved products from shopify collection api -------");
  console.log(productIds);
  console.log("-------------");
  console.log("Query Extension ",response.data.extensions);
  return productIds;
}

export default async function getExclusionItems(session) {
  console.log("3.Next Getting the Exlusion or Restricted item list");
  const time_var = "/api/exclist/graph";
  const metricName = "api_exclist_graph";
  const startTime = process.hrtime();
  console.time(time_var);
  let productIds = null;
  let env = "production";
  try {
    if(env === "production"){
      if (!process.env.EXCLUSION_LIST_TABLE_NAME) {
        throw new Error("EXCLUSION_LIST_TABLE_NAME is required");
      }
      const EXCLUSION_STORAGE = new DynamoDBExclusionStorage(process.env.EXCLUSION_LIST_TABLE_NAME, process.env.AWS_REGION);
      const collectionId = "point-restrictions";
      productIds = await EXCLUSION_STORAGE.loadExclusionList(collectionId);
      console.log(">===========  Product ids from DB ============<");
      console.log(productIds);
      if(productIds === null || productIds === undefined){
        productIds = await exclusionList(session);
        let data = await EXCLUSION_STORAGE.storeExclusionList(collectionId,productIds);
        console.log("------- Stored the exclusion list in dynamo DB-------");
        console.log(data);
      }
    }else{
      productIds =  await exclusionList(session);
      console.log(">===========  ENV DEV ============<");
      console.log(productIds);
    }
    console.timeEnd(time_var);
    return productIds;
  } catch (error) {
    console.log("error getting the exclusion list",error);
    console.timeEnd(time_var);
    if (error instanceof Shopify.Errors.GraphqlQueryError) {
      throw new Error(
        `${error.message}\n${JSON.stringify(error.response, null, 2)}`
      );
    } else {
      throw error;
    }
  }finally{
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_extensions_rewards" });
  }
}
