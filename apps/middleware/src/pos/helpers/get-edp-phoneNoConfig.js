import { EmployeeDirectoryStore } from "../datastore/employee-directory-store.js"
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

export default async function getPhoneNumberConfigs(session) {
    console.log("Fetching EDP phone number configurations...");
    const metricName = "get_phone_number_configs";
    const timeVar = "/getPhoneNumberConfigs";
    const startTime = process.hrtime();
    console.time(timeVar);

    let phoneConfigs = {};
    try {
        console.log("Initializing DynamoDB access for EDP Phone Configs...");
        const featureConfig = new EmployeeDirectoryStore();

        phoneConfigs = await featureConfig.getEDPPhoneConfig();

        console.log("Fetched phone number configs:", phoneConfigs);
    } catch (error) {
        console.error("Error fetching EDP phone number configs:", error);
    }

    console.timeEnd(timeVar);
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_edp_phoneNumberConfigs" });

    return phoneConfigs;
}
