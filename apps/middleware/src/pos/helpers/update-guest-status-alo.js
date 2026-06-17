import { useControlledAloApiFetch } from "./useControlledFetch.js";
import encodeAuthToken from "./generate-token.js";
import DynamoPosAloAccessFeatureConfig from "../datastore/alo-apps-feature.js";
import { updateGuestStatus } from "./update-guest-status.js";
import util from "util";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const ID = "loyalty-direct-integration";

export async function updateGuestStatusWrapper(customerId, customerEmailId, optIn, api_name) {
  const metricName = "loyalty_guest_status";
  const startTime = process.hrtime();
  const time_var = "/loyalty/guest/status";
  const aloSetGuestStatus = process.env.ALO_SET_GUEST_STATUS || 'https://api.qa.alo.software/v1/loyalty/activities';
  console.time(time_var);

  const featureConfg = new DynamoPosAloAccessFeatureConfig();
  const featureRes = await featureConfg.getFeatureConfig(ID);
  console.log(util.format("Guest Update Feature feature Res =  %j", featureRes));
  const enabled = featureRes.enabled || false;

  if (enabled) {
    console.log("======== DIRECT LL INTEGRATION ENABLED ========");
    updateGuestStatus(customerId, customerEmailId, optIn);
  } else {
    console.log("======== ALO ACCESS INTEGRATION ENABLED ========");

    let guestStatusLoad = {
      name: "guest_status_update",
      customer_id: customerId,
      customer_email: customerEmailId,
      guest: false,
    };

    const api_req = JSON.stringify(guestStatusLoad);
    const token = encodeAuthToken();
    console.log("The ALO_SET_GUEST_STATUS api request", api_req);
    console.log("updateGuestStatus ALO_SET_GUEST_STATUS:", aloSetGuestStatus);

    let retries = 3;
    const retryDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (retries > 0) {
      try {
        const options = {
          method: "POST",
          body: api_req,
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Customer-ID": +customerId,
            "Accept": "application/json",
            Authorization: `Bearer ${token}`,
          },
        };

        const response = await useControlledAloApiFetch(aloSetGuestStatus.toString(), options);
        const status = response.status;
        const statusText = response.statusText;
        console.log(util.format("Response from API: %s for Req: %j = %s", aloSetGuestStatus, api_req, status));

        if (status === 200 || status === 201) {
          console.log("Successfully got the Guest Status response", statusText);
          break; // Success, exit loop
        } else {
          console.log("ALO_SET_GUEST_STATUS API response was not OK, retrying...");
          retries--;
          if (retries === 0) {
            console.log("Failed to update guest status after 3 attempts.", api_req);
          }
        }
      } catch (err) {
        if (err.message.includes('timed out')) {
          console.error(`Request timeout. Retries left: ${retries - 1}`);
        } else {
          console.error("ALO_SET_GUEST_STATUS API response was not OK", err);
        }
        retries--;
        if (retries > 0) {
          await retryDelay(1000 * (3 - retries)); // Exponential backoff
          console.log(`Retrying... (${3 - retries}/3)`);
        } else {
          console.error("Max retries reached. Failed to update guest status.");
          console.log("Failed to update guest status.", api_req);
          throw err; // Re-throw the error after max retries
        }
      }
    }
  }

  const endTime = process.hrtime(startTime);
  logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: api_name });
  console.timeEnd(time_var);
}
