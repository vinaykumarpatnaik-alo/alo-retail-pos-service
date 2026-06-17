
import customerGetData from "./get-customer-data.js";
import { useControlledAloApiFetch } from "./useControlledFetch.js";
import encodeAuthToken from "./generate-token.js";
import { formatSanitizeInput } from "./sanitize-input.js";
import getExclusionItems from "./get-exclusion-items.js";
import getProductPrice from "./get-product-price.js";
import getEnableFlags from "./get-enable-flags.js";
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";


async function processAloAccess(userId, session) {
    let customerData, customerInfo, marketingConsent, loyaltyInfo, exclusionList, blockedStatus, gifts = [], llRewards = [], tempEnableRecords;
    console.log("------ PROCESS ALO ACCESS DATA -------");
    try {

        customerInfo = await customerGetData(session, userId, "api_extensions_rewards");
        if (!customerInfo || customerInfo === undefined) {
            throw new Error("Failed to get customer details for userId ", userId);
        }
        marketingConsent = extractMarketingConsent(customerInfo);
        loyaltyInfo = extractLoyaltyInfo(customerInfo);
        //default to tier1 if customer has email
        if (customerInfo?.email && !loyaltyInfo.loyalty_tier) {
            loyaltyInfo.loyalty_tier = "tier1";
        }
        const isEnroll = loyaltyInfo?.isUpdateEnrolldate ? loyaltyInfo?.isUpdateEnrolldate : true
        const tags = customerInfo?.tags?.map((tag) => tag.trim());
        console.log(`Customer id : ${userId}, Tags ${tags}`);
        customerData = {
            firstName: customerInfo?.firstName || " ",
            lastName: customerInfo?.lastName || "",
            email: customerInfo?.email || "",
            phone: customerInfo?.phone || "",
            id: customerInfo?.id.replace("gid://shopify/Customer/", "") || "",
            marketingInd: marketingConsent,
            tags: tags || [],
            isUpdateEnrolldate: isEnroll,
            loyaltyInd: true,
            loyaltyInfo: loyaltyInfo,
        };
        customerData.loyaltyInd = true,
            customerData.loyaltyInfo = loyaltyInfo,
            console.log("3. Making parallel calls for additional data");
        const results = await Promise.allSettled([
            getExclusionItems(session),
            checkedIfBlocked(customerInfo?.email),
            getGiftInfo(tags),
            getLLRewards(userId),
            getEnableFlags(),
        ]);
        // Destructure the results array to individual result variables
        const [exclusionResult, blockedStatusResult, giftResult, llRewardsResult, enableFlagsResult] = results;
        if (exclusionResult.status === 'fulfilled') {
            exclusionList = exclusionResult.value;
        } else {
            console.error("Failed to load exclusion items:", exclusionResult.reason);
        }
        if (exclusionList === null || exclusionList === undefined) {
            exclusionList = process.env.EXCLUSION_PRODUCT_LIST;
        }
        // Handle each result separately, allowing some to fail without affecting others
        if (giftResult.status === 'fulfilled') {
            gifts = giftResult.value;
        } else {
            console.error("Failed to get gift info:", giftResult.reason);
            gifts = []
        }

        if (blockedStatusResult.status === 'fulfilled') {
            blockedStatus = blockedStatusResult.value;
        } else {
            console.error("Failed to get blocked status:", blockedStatusResult.reason);
            blockedStatus = false;
        }

        if (llRewardsResult.status === 'fulfilled') {
            llRewards = llRewardsResult.value;
        } else {
            console.error("Failed to get LL rewards:", llRewardsResult.reason);
            llRewards = [];
        }
        if (enableFlagsResult.status === 'fulfilled') {
            tempEnableRecords = enableFlagsResult.value;
        } else {
            console.error("Failed to discount codes from DB:", enableFlagsResult.reason);
            tempEnableRecords = [];
        }
        const { giftInfo, aloRewardsArr } = await processGiftsAndRewards(gifts, llRewards, session);
        const { giftArr, giftOrRewardsList } = await applyDBConfiguration(tempEnableRecords, giftInfo);

        customerData.gifts = giftArr === undefined ? [] : giftArr;
        customerData.exclusionList = exclusionList;
        customerData.blockedStatus = blockedStatus;
        customerData.llRewards = aloRewardsArr === undefined ? [] : aloRewardsArr;
        customerData.enableFlags = giftOrRewardsList === undefined ? [] : giftOrRewardsList;

    } catch (e) {
        console.error(e);
        customerData.error = e.message;
        return { status: 500, error: e.message };
    }
    console.log("------- Final Rewards Response Data ------ ");
    console.log(customerData);
    console.log("------------------------------------------- ");
    return customerData;
}

async function processOnlyGifts(userId, session) {
    let customerData = {}; 
    let giftOnly;         
    try {
      /* ─── Feature-flag  ─────────────────────────── */
      const flags = await getEnableFlags();
      const getFlagEnabled = (id) =>
        flags.find(f => f.id === id)?.enabled === true;
      const birthdayGiftEnabled  = getFlagEnabled('Birthday Gift');

      console.log("Birthday Gift Enabled:", birthdayGiftEnabled);
      
    //   //  Proceed only if *both* flags are ON
      if (!(birthdayGiftEnabled)) {
        return { status: 204, data: null };         // or `return null`, `return false`, etc.
      }
  
      /* ─── Pull customer + loyalty info ─────────────── */
      const customerInfo = await customerGetData(
        session,
        userId,
        'api_extensions_rewards',
      );
      if (!customerInfo) {
        throw new Error(`Failed to get customer details for userId ${userId}`);
      }
  
      const loyaltyInfo = extractLoyaltyInfo(customerInfo);
      if (!(loyaltyInfo?.birthday && loyaltyInfo?.enroll_date)) {
        return { status: 204, data: null };
      }
  
      /* ─── Get gifts ─────────────────────────────────── */
      const tags        = customerInfo.tags?.map((t) => t.trim()) ?? [];
      customerData      = await getGiftInfo(tags, giftOnly = true);
      console.log("Gifts only retrieved:", customerData);
  
      return { status: 200, data: customerData };
    } catch (e) {
      console.error(e);
      return { status: 500, error: e.message };
    }
  }
   

async function processGiftsAndRewards(giftInfo, llRewards, session) {
    const customRewards = llRewards?.filter(
        (lreward) => lreward?.discount_type?.toLowerCase() === "custom"
    );
    const llRegex =
        /variant_id=(\w*),\s*product_id=(\w*),\s*style=(\w*),\s*image=([^,]*)/i;
    const aloRewardsArr = [];
    for (let i = 0; i < customRewards?.length; i++) {
        const lReward = customRewards[i];
        const lDescription = lReward?.description;
        // console.log("[LOYALTY REWARDS] lDescription:", lDescription);
        const values = lDescription.match(llRegex);
        // console.log("[LOYALTY REWARDS] values:", values);
        if (values?.length >= 5 && values[1]) {
            let [, variantId, productId, style, image] = values;
            let aReward = {
                id: lReward?.id,
                title: lReward?.title,
                discount_type: lReward?.discount_type,
                point_cost: lReward?.point_cost,
                variantId: variantId,
                productId: productId,
                style: style,
                image: image,
                imageAltText: lReward?.title,
            };
            aloRewardsArr.push(aReward);
        }
    }

    // Extract variant ids from both giftInfo and customRewards
    const giftVariantIds = giftInfo.map(gift => gift?.variant_id);
    const rewardVariantIds = aloRewardsArr.map(reward => reward?.variantId);

    // Combine both arrays and remove duplicates
    const allVariantIds = [...new Set([...giftVariantIds, ...rewardVariantIds])];
    console.log("The variant id's for pricing....");
    console.log(allVariantIds);
    // Fetch product prices for all unique variant IDs
    try {
        const allPrices = await getProductPrice(session, allVariantIds);
        // Create a map of variantId to price
        const priceMap = new Map();
        allVariantIds.forEach((variantId, index) => {
            priceMap.set(variantId, allPrices[index]);
        });
        // Set prices for giftInfo and customRewards
        setPrices(giftInfo, priceMap);
        setPrices(aloRewardsArr, priceMap); // assuming custom rewards are in this array
    } catch (err) {
        console.error("Error occurred while fetching product prices. Prices will not be set.", err.message);
        return { gifts: [], llRewards: [] };
    }
    return { giftInfo, aloRewardsArr };

};

// Function to set prices based on a map of variantIds to prices
function setPrices(items, priceMap) {
    items.forEach(item => {
        const variantId = item?.variantId || item?.variant_id;
        if (priceMap.has(variantId)) {
            item.price = priceMap.get(variantId);
        }
    });
}

async function getGiftInfo(tags, giftOnly = false) {
    console.log("3. Next Get the gifts info from alo api");
    const metricName = "loyalty_gifts";
    const startTime = process.hrtime();
    const time_var = '/loyalty/gifts';
    const giftsEndpoint = process.env.GIFTS_ENDPOINT || "https://api.qa.alo.software/v1/loyalty/gifts";

    try {
        console.time(time_var);
        // Convert the tags array into query parameters
        const queryParams = tags.map(tag => `shopify_customer_tags=${encodeURIComponent(tag)}`).join('&');
        const url = `${giftsEndpoint}?${queryParams}&is_logged_in=true`;

        console.log("getGiftInfo GIFTS_END_POINT:", url);
        const response = await useControlledAloApiFetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
            console.error(`The gifts NOT OK api response  : ${response}`);
            throw new Error("Gift api response was not OK");
        }

        const jsonResponse = await response.json();
        console.log("Successfully got the gift response", jsonResponse);
        console.timeEnd(time_var);
        if (giftOnly) {
            return { gifts: jsonResponse.gifts, tags }; 
        }
        return jsonResponse.gifts;

    } catch (error) {
        console.error(error);
        console.timeEnd(time_var);
        if (giftOnly) {
            return { gifts: [], tags }; 
        }
        return [];
    } finally {
        const endTime = process.hrtime(startTime);
        logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_extensions_rewards" });
    }
}




async function checkedIfBlocked(emailID) {
    console.log("3.Next Check if the customer is blocked");
    const time_var = '/rewards/loyalty/blocked';
    const metricName = "loyalty_blocked";
    const startTime = process.hrtime();
    const blockedCustomerEndpoint = process.env.BLOCKED_CUSTOMER_END_POINT || "https://api.qa.alo.software/v1/loyalty/blocked";
    try {
        console.time(time_var);
        console.log("The BLOCKED_CUSTOMER_END_POINT api request", emailID);
        if (!emailID || emailID === undefined) {
            console.log("Email id is undefined while checking blocked status returning false");
            return false;
        }
        const emailInput = { email: emailID };
        const blocked_api_request = JSON.stringify(emailInput);

        console.log("checkedIfBlocked BLOCKED_CUSTOMER_END_POINT:", blockedCustomerEndpoint);
        console.log("checkedIfBlocked REQUEST:", blocked_api_request);
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
            throw new Error("Loyalty Blocked api response was not OK");
        }

        const data = await response.json();
        console.log("Successfully got the Blocked Status response", data);

        return data?.blocked;

    } catch (error) {
        console.error(error);

        return false;  // You can return null or any other value indicating failure
    } finally {
        console.timeEnd(time_var);
        const endTime = process.hrtime(startTime);
        logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_extensions_rewards" });
    }
}

async function getLLRewards(customerId) {
    console.log("3.Next Get the reward items from LL");
    const time_var = '/v1/loyalty/rewards';
    const metricName = "v1_loyalty_rewards";
    const startTime = process.hrtime();
    const llRewardsEndpoint = process.env.LLREWARDS_END_POINT || "https://api.qa.alo.software/v1/loyalty/rewards";
    try {
        console.time(time_var);
        console.log(`LOYALTY LION REWARDS Api request for customer ${customerId}`);
        let retVal;

        if (customerId) {
            console.log(`LOYALTY LION REWARDS payload : ${customerId}`);
            console.log(`LOYALTY LION REWARDS getLLRewards LLREWARDS_END_POINT : ${llRewardsEndpoint}`);

            const llToken = encodeAuthToken(); // Assuming encodeAuthToken is defined elsewhere in your code

            const options = {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Customer-ID": +customerId,
                    Authorization: `Bearer ${llToken}`,
                },
            };
            const response = await useControlledAloApiFetch(llRewardsEndpoint.toString(), options);

            if (!response.ok) {
                const errorResult = await response.json();
                console.log("Error Loyalty Rewards errorResult details", errorResult);
                throw new Error(`Loyalty Lion Rewards Get ERROR: Customer ${customerId} LL Get failed`);
            }

            const json = await response.json();
            console.log(formatSanitizeInput(`LOYALTY LION GET SUCCESSFUL: Customer %s:`, customerId), json);

            retVal = json;
        } else {
            console.log("LOYALTY LION REWARDS: No customer ID");
        }

        console.log("retval:", retVal);
        console.timeEnd(time_var);

        return retVal?.rewards || [];

    } catch (error) {
        console.error(error);
        console.timeEnd(time_var);
        return []; // Return empty array on error
    } finally {
        const endTime = process.hrtime(startTime);
        logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_extensions_rewards" });
    }
}

async function applyDBConfiguration(tempEnableRecords, giftsInfo) {
    let giftArr = giftsInfo;
    const WELCOME_10PCT_OFF = "Welcome 10% OFF";
    const GIFT_CARD_DISCOUNT = "Gift Card Discount";

    // Main code starts
    const giftOrRewardsList = [
        { id: "Welcome Gift", value: false },
        { id: "Exclusive Gift", value: false },
        { id: "Birthday Gift", value: false },
        { id: "Loyalty Reward", value: false },
        { id: "Discount", value: false },
    ];

    console.log("tempEnableRecords :", tempEnableRecords);
    const filterDiscounts = tempEnableRecords?.filter(({ code, enabled }) => code && enabled);
    console.log("filterDiscounts:", filterDiscounts);

    // Update giftArr (assuming it is declared and initialized before this method is called)
    if (filterDiscounts?.length > 0) {
        console.log(`Discount present`);
        let arrAll = Array.from(giftArr);
        const discountData = {
            title: WELCOME_10PCT_OFF, // assuming WELCOME_10PCT_OFF is a defined constant
            tier: "all_tiers",
            gift_type: "discount", // assuming GIFT_CARD_DISCOUNT is a defined constant
            discountCode: "",
        };
        for (let i = 0; i < filterDiscounts?.length; i++) {
            let discountRec = filterDiscounts[i];
            discountData.title = discountRec?.id || "";
            discountData.discountCode = discountRec?.code || "";
            arrAll.push({ ...discountData });
            break;
        }
        giftArr = arrAll;
    }
    giftOrRewardsList.forEach((item) => {
        const { id, value } = item;

        if (id !== "Discount") {
            const matchingRecord = tempEnableRecords?.find((dbRec) => dbRec.id?.toLowerCase() === id?.toLowerCase());
            item.value = matchingRecord?.enabled || value;
        } else if (filterDiscounts?.length > 0) {
            item.value = true;
        }
    });
    return { giftArr, giftOrRewardsList };
}

function extractMarketingConsent(customerInfo) {
    console.log(
        "1. Extracting marketing consent"
    );
    const state = customerInfo && customerInfo.emailMarketingConsent ? customerInfo.emailMarketingConsent.marketingState : null;
    return state?.localeCompare("subscribed", undefined, {
        sensitivity: "accent",
    }) === 0;
}

function extractLoyaltyInfo(customerInfo) {
    console.log(
        "2. Extracting loyalty info"
    );
    const loyaltyInfoMap = new Map();
    let isUpdateEnrolldate = true; // Initialize the flag

    if (!customerInfo || customerInfo === undefined) {
        return Object.fromEntries(loyaltyInfoMap);
    }
    const userId = customerInfo?.id.replace("gid://shopify/Customer/", "");
    const loyaltyEdges = customerInfo?.loyalty?.edges || [];
    const factEdges = customerInfo?.facts?.edges || [];

    console.log("fact_edges:", factEdges);
    console.log("loyalty_edges:", loyaltyEdges);
    // Extract birth date if available
    for (const edge of factEdges) {
        if (edge.node.key === "birth_date") {
            const dateString = edge.node.value;
            console.log(`The date string : ${dateString}`);
            loyaltyInfoMap.set("birthday", dateString);
        }
    }
    // Extract loyalty information
    for (const edge of loyaltyEdges) {
        const { node } = edge;
        const { key, value, type } = node;

        if (type === "number_integer") {
            loyaltyInfoMap.set(key, Number.parseInt(value));
        } else {
            loyaltyInfoMap.set(key, value);
        }
        if (key === "enroll_date") {
            console.log(`Customer id:[${userId}] loyalty enroll date [${value}]`);
            if (value) {
                isUpdateEnrolldate = false;
                console.log(`Customer id:[${userId}] loyalty enroll date is present.`);
            } else {
                console.log(`Customer id:[${userId}] loyalty enroll date is empty. Update enroll date [${isUpdateEnrolldate}]`);
            }
        }
        loyaltyInfoMap.set("isUpdateEnrolldate", isUpdateEnrolldate);

    }
    return Object.fromEntries(loyaltyInfoMap);;
}

export { getGiftInfo, checkedIfBlocked, getLLRewards, processAloAccess,processOnlyGifts }
