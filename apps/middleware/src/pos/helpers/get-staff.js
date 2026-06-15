import shopify from "../shopify.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const GET_STAFF_QYERY = (staffId) => `query {
  staffMember(id: "gid://shopify/StaffMember/${staffId}") { 
    id
    firstName
    lastName
    email
    phone
  }
}`;

export default async function getStaff(session, staffId) {
  const metricName = "get_staff";
  const startTime = process.hrtime();
  console.log("Staff - get function");
  const client = new shopify.api.clients.Graphql({ session }); 
  let response = null;
  try {
    response = await client.request(GET_STAFF_QYERY(staffId));
    console.log("Got Staff Details for Id ", staffId);
    return response.data.staffMember;
  } catch (error) {
    console.error("Error getting staff data", error);
    return error
  }finally{
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_extensions_employee" });
  }
}
