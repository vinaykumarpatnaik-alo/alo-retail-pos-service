import useControlledFetch from "./useControlledFetch.js";

export async function updateGuestStatus(customerId, customerEmailId, optIn) {
  const guestStatusSetLl = process.env.GUEST_STATUS_SET_LL || '';
  // const time_var="/loyalty/guest/status";
  // console.time(time_var);
  let guestStatusLoad = {
    name: "guest_status_update",
    customer_id: customerId,
    customer_email: customerEmailId,
    guest: false,
  };
  const api_req = JSON.stringify(guestStatusLoad);
  console.log("guestStatusLoad Customer Id :", customerId);
  console.log(
    "The GUEST_STATUS_SET_LL api request", api_req);
  let LOYALTYLION_API_TOKEN = process.env.LOYALTYLION_API_TOKEN;
  let LOYALTYLION_API_SECRET = process.env.LOYALTYLION_API_SECRET;
  var auth =
    "Basic " +
    Buffer.from(LOYALTYLION_API_TOKEN + ":" + LOYALTYLION_API_SECRET).toString(
      "base64"
    );
  // console.log("guest authorization:", auth);
  console.log(" updateGuestStatus GUEST_STATUS_SET_LL:", guestStatusSetLl);
  try {
    const timeoutValue = 20000;  //configure to 20 sec instead of default process.env.DEFAULT_API_TIMEOUT
    const timeout = timeoutValue ? parseInt(timeoutValue, 10) : 20000;  // 10 (meaning decimal) and 10000 mills
    console.log("DEFAULT_API_TIMEOUT configured = ",timeout);
    const response = await useControlledFetch(guestStatusSetLl.toString(), {
      method: "POST",
      body: api_req,
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
    },timeout);
    const status = response.status;
    const statusText = response.statusText;
    console.log(`Response from ${guestStatusSetLl} api: `, status );

    if (status === 201) {
      console.log(
        "Sucessfully got the Guest Status response",
        statusText
      );
    } else {
      console.log("GUEST_STATUS_SET_LL api response was not OK");
    }
  } catch (err) {
    console.error("GUEST_STATUS_SET_LL api response was not OK",err);
    console.error("GUSET_STATUS_LL FAILED for REQUEST ::  ", api_req);
    console.log(`error from ${guestStatusSetLl} api: `, err.message);
  }
  // console.timeEnd(time_var);
}
