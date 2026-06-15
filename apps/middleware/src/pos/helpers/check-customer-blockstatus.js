import { useControlledAloApiFetch } from "./useControlledFetch.js";
export const BLOCKED_CUSTOMER_END_POINT = process.env.BLOCKED_CUSTOMER_END_POINT || '';

export async function checkedIfBlocked(emailID) {
  console.log("The BLOCKED_CUSTOMER_END_POINT api request", emailID);
  const time_var = '/loyalty/blocked';
  console.time(time_var);
  try {
    const emailInput = { email: emailID };
    const blocked_api_request = JSON.stringify(emailInput);
    console.log(
      "checkedIfBlocked BLOCKED_CUSTOMER_END_POINT:",
      BLOCKED_CUSTOMER_END_POINT
    );
    const response = await useControlledAloApiFetch(
      BLOCKED_CUSTOMER_END_POINT?.toString(),
      {
        method: "POST",
        body: blocked_api_request,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  
    if (!response.ok) {
      console.log("Error from blocked loyalty api: ", response);
      return false
    }
  
    const data = await response.json();
    console.log("Successfully got the Blocked Status response", data);
    
    return data?.blocked;;
  } catch (error) {
    console.error(error);
    return false;
  }finally{
    console.timeEnd(time_var);
  }
}