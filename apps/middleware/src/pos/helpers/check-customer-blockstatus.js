import { useControlledAloApiFetch } from "./useControlledFetch.js";

export async function checkedIfBlocked(emailID) {
  const blockedCustomerEndpoint = process.env.BLOCKED_CUSTOMER_END_POINT || '';
  console.log("The BLOCKED_CUSTOMER_END_POINT api request", emailID);
  const time_var = '/loyalty/blocked';
  console.time(time_var);
  try {
    const emailInput = { email: emailID };
    const blocked_api_request = JSON.stringify(emailInput);
    console.log(
      "checkedIfBlocked BLOCKED_CUSTOMER_END_POINT:",
      blockedCustomerEndpoint
    );
    const response = await useControlledAloApiFetch(
      blockedCustomerEndpoint?.toString(),
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
