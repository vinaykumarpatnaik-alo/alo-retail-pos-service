import { EmployeeDirectoryStore } from "../datastore/employee-directory-store.js"
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

export default async function getPreorderCheckConfigs(session) {
    console.log("Fetching Preorder check configurations...");
    const metricName = "get_preorder_check_configs";
    const timeVar = "/getPreorderCheckConfigs";
    const startTime = process.hrtime();
    console.time(timeVar);

    let preorderCheckConfigs = {};
    try {
        console.log("Initializing DynamoDB access for Preorder check Configs...");
        const featureConfig = new EmployeeDirectoryStore();

        preorderCheckConfigs = await featureConfig.getPreorderCheckConfig();

        console.log("Fetched Preorder Check configs:", preorderCheckConfigs);
    } catch (error) {
        console.error("Error fetching Preorder Check configs:", error);
    }

    console.timeEnd(timeVar);
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_preorderCheck_Configs" });

    return preorderCheckConfigs;
}
