import { EmployeeDirectoryStore } from "../datastore/employee-directory-store.js"
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

export default async function getScanDiscountData(session) {
    console.log("Fetching Scan Discount configurations...");
    const metricName = "get_scan_discount_data";
    const timeVar = "/getScanDiscountData";
    const startTime = process.hrtime();
    console.time(timeVar);

    let scanDiscountDataConfig = {};
    try {
        console.log("Initializing DynamoDB access for ScanDiscount Data Configs...");
        const featureConfig = new EmployeeDirectoryStore();

        scanDiscountDataConfig = await featureConfig.getScanDiscountDataConfig();

        console.log("Fetched Scan Discount data configs:", scanDiscountDataConfig);
    } catch (error) {
        console.error("Error fetching ScanDiscount data:", error);
    }

    console.timeEnd(timeVar);
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_scanner_discount" });

    return scanDiscountDataConfig;
}
