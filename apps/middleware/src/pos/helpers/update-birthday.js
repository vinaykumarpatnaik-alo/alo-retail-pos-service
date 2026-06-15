import { useControlledAloApiFetch } from "./useControlledFetch.js";
import util from "util";
const BIRTHDATE_UPDATE_END_POINT = process.env.BIRTHDATE_UPDATE_END_POINT;
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

export async function updateBirthday(birthdate, customerId, token, api_name) {
  const metricName = "v1_account_birthday";
  const startTime = process.hrtime();
  const time_var = "/v1/account/birthday";
  let retVal;
  let retries = 3;
  const retryDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // Delay function

  console.time(time_var);
  console.log('token', token);
  console.log(util.format("BIRTHDAY UPDATE: Api request for customer %s is: %j", customerId, birthdate));

  if (birthdate) {
    birthdate.day = isNaN(parseInt(birthdate.day))
      ? console.log(`BIRTHDAY UPDATE: Error while parsing the birth day string ${birthdate.day} ..`)
      : parseInt(birthdate.day);
  } else {
    console.log("BIRTHDAY UPDATE: No birth date");
  }

  const payload = JSON.stringify(birthdate);
  console.log(`BIRTHDAY payload : ${payload}`);

  const options = {
    method: "POST",
    body: payload,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Customer-ID": +customerId,
      Authorization: `Bearer ${token}`,
    },
  };

  console.log("updateBirthday BIRTHDATE_UPDATE_END_POINT: ", BIRTHDATE_UPDATE_END_POINT);

  while (retries > 0) {
    try {
      const response = await useControlledAloApiFetch(BIRTHDATE_UPDATE_END_POINT.toString(), options);

      console.log("B'day Response Status = ", response.status);
      if (!response.ok) {
        const errorResult = await response.json();
        console.log("Error adding birthday errorResult details", errorResult);
        throw new Error(`BIRTHDAY UPDATE ERROR: Customer ${customerId} birthday update failed`);
      }

      const json = await response.json();
      console.log(`BIRTHDAY UPDATE: Customer ${customerId} birthday added successfully`);
      console.log("BIRTHDAY UPDATE RESPONSE:", json);
      retVal = json;
      break; // Success, so break the loop

    } catch (err) {
      if (err.message.includes('timed out')) {
        console.error(`Request timeout. Retries left: ${retries - 1}`);
      } else {
        console.error(err);
      }

      retries--;
      if (retries > 0) {
        await retryDelay(1000 * (3 - retries)); // Exponential backoff
        console.log(`Retrying... (${3 - retries}/3)`);
      } else {
        console.error("Max retries reached. Failed to update birthday.", JSON.stringify(payload));
        throw err; // Rethrow error after max retries
      }
    }
  }

  const endTime = process.hrtime(startTime);
  logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: api_name });
  console.timeEnd(time_var);
  return retVal;
}
