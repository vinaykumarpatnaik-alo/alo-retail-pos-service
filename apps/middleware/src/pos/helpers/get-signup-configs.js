import DynamoPosAloAccessFeatureConfig from "../datastore/alo-apps-feature.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

const ADD_EDIT_CUSTOMER_CONFIG_ID = "Add_Edit_Customer_Configs";

function getShopConfig(configItem, shopDomain) {
  if (!configItem || !shopDomain) {
    return null;
  }

  const shopKey = String(shopDomain).split(".")[0];
  const shops = configItem.shops || {};

  return shops[shopDomain] || shops[shopKey] || null;
}

export default async function getSignupConfigs(session) {
  console.log("Fetching signup configurations...");
  const metricName = "get_signup_configs";
  const timeVar = "/getSignupConfigs";
  const startTime = process.hrtime();
  console.time(timeVar);

  const shopDomain = session?.shop || "";
  let payload = {
    shopDomain,
    showLocalTourist: false,
    showAloAccessOptIn: false,
    showMarketingEmails: false,
    showBday: false,
    metafieldBdayUpdate: false,
    allAccessBannerEnabled: false,
    phoneNumberCode: "1",
    showAgeRange: false,
    ageRanges: [],
    isTierBasedLoyalty:false,
    minimumLoyaltyPoints: 5000
  };

  try {
    const featureConfig = new DynamoPosAloAccessFeatureConfig(process.env.FEATURE_CONFIGS_TABLE_NAME);

    const addEditCustomerConfig = await featureConfig.getFeatureConfig(ADD_EDIT_CUSTOMER_CONFIG_ID);

    const addEditCustomerShopConfig = getShopConfig(addEditCustomerConfig, shopDomain);

    payload = {
      shopDomain,
      showLocalTourist: Boolean(addEditCustomerShopConfig?.showLocalTourist),
      showAloAccessOptIn: Boolean(addEditCustomerShopConfig?.showAloAccessOptIn),
      showMarketingEmails: Boolean(addEditCustomerShopConfig?.showMarketingEmails),
      showBday: Boolean(addEditCustomerShopConfig?.showBday),
      metafieldBdayUpdate: Boolean(addEditCustomerShopConfig?.metafieldBdayUpdate),
      phoneNumberCode: addEditCustomerShopConfig?.phoneNumberCode || "1",
      allAccessBannerEnabled: Boolean(addEditCustomerShopConfig?.allAccessBannerEnabled),
      showAgeRange: Boolean(addEditCustomerShopConfig?.showAgeRange),
      ageRanges: addEditCustomerShopConfig?.ageRanges || [],
      isTierBasedLoyalty: Boolean(addEditCustomerShopConfig?.isTierBasedLoyalty),
      minimumLoyaltyPoints: addEditCustomerShopConfig?.minimumLoyaltyPoints || 0
    };

    console.log("Fetched signup configs:", payload);
  } catch (error) {
    console.error("Error fetching signup configs:", error);
  }

  console.timeEnd(timeVar);
  const endTime = process.hrtime(startTime);
  logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_signup_configs" });

  return payload;
}
