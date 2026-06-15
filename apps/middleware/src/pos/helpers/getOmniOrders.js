
import dotenv from 'dotenv';
dotenv.config();
import util from "util";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";
const ALO_STORE_ENDPOINT = process.env.ALO_STOREFULFILLMENT_URL;
const CLIENT_ID = process.env.STOREFULFILLMENT_API_KEY; // Add this to your environment variables
const CLIENT_SECRET = process.env.STOREFULFILLMENT_API_SECRET_KEY; // Add this to your environment variables
console.log("ALO_STOREFULFILLMENT_URL:", ALO_STORE_ENDPOINT);
console.log("STOREFULFILLMENT_API_KEY:", CLIENT_ID);
console.log("STOREFULFILLMENT_API_SECRET_KEY:", CLIENT_SECRET);

async function getOmniOrders(locationId, fulfillmentType, isTransferOrder, session) {
    const metricName = "api_omni_orders";
    const startTime = process.hrtime();
    const time_var = "/pos/v1/omni/getOrderDetails";
    console.log("Location ID:", locationId);
    console.log('ALO_STORE_ENDPOINT', ALO_STORE_ENDPOINT)

    // Step 1: Fetch the token
    const tokenUrl = `${ALO_STORE_ENDPOINT}/oauth2/token`;
    let token;

    try {
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            }),
        });

        if (!tokenResponse.ok) {
            throw new Error(`Failed to fetch token: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json();
        token = tokenData.accessToken;
    } catch (error) {
        console.error("Error fetching token:", error);
        throw new Error("Unable to fetch authentication token");
    }

    console.log("Fetched token:", token);

    // Step 2: Fetch the order statistics
    const orderStatsUrl = `${ALO_STORE_ENDPOINT}/store-hub/order-statistics/${locationId}?fulfillmentType=${fulfillmentType}&isTransferOrder=${isTransferOrder}`;

    try {
        const orderResponse = await fetch(orderStatsUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!orderResponse.ok) {
            throw new Error(`Failed to fetch order statistics: ${orderResponse.statusText}`);
        }

        const orderData = await orderResponse.json();
        console.log("Fetched Order Data:", orderData);
        return orderData;
    } catch (error) {
        console.error("Error fetching order statistic:", error);
        throw new Error("Unable to fetch order details");
    }finally{
        const endTime = process.hrtime(startTime);
        logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_extensions_omni_orders", time_var });
        console.log("API call completed in:", hrtimeToMilliseconds(endTime), "ms");
    }
}

export default getOmniOrders;
