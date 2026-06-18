
import DynamoPosAloAccessFeatureConfig from "../datastore/alo-apps-feature.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

export default async function getEnableFlags() {
  console.log("3.Next Getting the DB flags and discount configuration");
  const time_var = "/getEnableFlags";
  const metricName = "get_enable_flags";
  const startTime = process.hrtime();
  console.time(time_var);
  let env = "production";
  let enableFlagArr = [];
  try {
    console.log("get gifts rewards TRY");
    if (env === "production") {
      console.log("get gifts rewards IF ");
      const featureConfg = new DynamoPosAloAccessFeatureConfig();
      enableFlagArr = await featureConfg.loadAllFeatures();
    }
  } catch (error) {
    console.log("error getting gift / rewards enable list", error);
  }
  console.log("enableFlagArr before return:", enableFlagArr);
  console.timeEnd(time_var);

  const endTime = process.hrtime(startTime);
  logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_extensions_rewards" });
  return enableFlagArr;
}
