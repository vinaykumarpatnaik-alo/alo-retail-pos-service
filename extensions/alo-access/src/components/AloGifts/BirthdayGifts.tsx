
import React, { useReducer, useRef } from "react";
import { GiftImages } from "./GiftImages";
import { Image, Section, Selectable, useApi, Stack, Text,List } from '@shopify/ui-extensions-react/point-of-sale';
import { GiftImagesGo } from "./GiftImagesGo";

const giftReducer = (state, action) => {
  const { type, payload } = action;
  switch (type) {
    case "LOADGIFTDATA":
      return {
        ...state,
      };

    default:
      return { ...state };
  }
};

export const BirthdayGifts = ({ customerInfo, cartData, messages }) => {
  const { name, getDeviceId } = useApi().device;
  const extractGiftLimits = () => {
    const gifts = customerInfo?.gifts || [];
    let giftLimit = 0;
    const giftVariants = [];

    for (let i = 0; i < gifts?.length; i++) {
      let gift = gifts[i];
      if (gift?.gift_type === "birthday_gift") {
        giftLimit = gift?.amount_to_spend || 0;
        let gdbCard = {};
        gdbCard.variantId = gift?.variant_id || 0;
        gdbCard.productId = gift?.product_id || 0;
        gdbCard.amountToSpend = gift?.amount_to_spend || 0;
        gdbCard.image = gift?.image || null;
        gdbCard.imageAltText = gift?.image_alt_text || "";
        gdbCard.price = gift?.price;
        giftVariants.push(gdbCard);
      }
    }
    if (isNaN(giftLimit)) {
      giftLimit = 0;
    }
    return [giftLimit, giftVariants];
  };

  const checkCartForGift = (giftVariants, giftType) => {
    let giftPresent = false;
    const variantIds = giftVariants?.map((variant) => variant?.variantId) || [];
    if (variantIds?.length == 0) {
      return giftPresent;
    }
    const lineItems = cartData?.lineItems;
    if (lineItems && Array.isArray(lineItems) && lineItems?.length > 0) {
      for (let i = 0; i < lineItems?.length; i++) {
        const cartItem = lineItems[i];
        if (
          cartItem?.discounts[0]?.discountDescription?.toLowerCase() ==
          giftType?.toLowerCase() &&
          cartItem?.discounts[0]?.amount > 0 &&
          cartItem?.discounts[0]?.type?.toLowerCase() == "fixedamount" &&
          variantIds?.includes(cartItem?.variantId?.toString())
        ) {
          giftPresent = true;
          continue;
        }
      }
    }
    return giftPresent;
  };

  const validateGift = () => {
    const [giftLimit, giftVariants] = extractGiftLimits();
    let isGiftEligible = false;
    let isGiftRedeemed = false;
    let isBdatePresent = false;
    const bDay = customerInfo?.loyaltyInfo?.birthday;
    let birthMonth = "";
    if (bDay) {
      birthMonth = new Date(bDay)?.toLocaleString("default", { month: "long" });
      isBdatePresent = true;
    } else {
      isBdatePresent = false;
    }
    const currentMonth = new Date().toLocaleString("default", {
      month: "long",
    });
    const bDayGiftTag = "EligibleForBirthdayGift";
    const isBdayTagPresent = Boolean(customerInfo?.tags?.includes(bDayGiftTag));
    if (isBdayTagPresent && isBdatePresent) {
      isGiftEligible = true;
      isGiftRedeemed = false;
    } else if (currentMonth?.toLowerCase() == birthMonth?.toLowerCase()) {
      isGiftEligible = false;
      isGiftRedeemed = true;
    } else {
      isGiftEligible = false;
      isGiftRedeemed = false;
    }

    const isAddedToCart = checkCartForGift(giftVariants, "Birthday Gift");

    return {
      isGiftEligible: isGiftEligible,
      isGiftRedeemed: isGiftRedeemed,
      isAddedToCart: isAddedToCart,
      isBdatePresent: isBdatePresent,
      giftLimit: giftLimit,
      giftVariants: giftVariants,
    };
  };

  let giftFlags = null;
  const giftRef = useRef(true);
  if (giftRef.current) {
    giftFlags = validateGift();
    giftRef.current = false;
  }

  const initialGiftLoad = {
    appliedToCartMsg: `${messages.AppliedToCart}`,
    rewardType: "Birthday Gift",
    rewardEligible: giftFlags?.isGiftEligible || false,
    rewardAddedToCart: giftFlags?.isAddedToCart || false,
    rewardRedeemed: giftFlags?.isGiftRedeemed || false,
    isBdatePresent: giftFlags?.isBdatePresent || false,
    rewardNoBdate: `${messages.BirthdayNotProvided}`,
    rewardNotEligible: `${messages.BirthdayNotCurrentMonth}`,
    type: "gift",
    desc: "Birthday Gift",
    amountToSpend: giftFlags?.giftLimit || 0,
    variants: giftFlags?.giftVariants || [],
  };

  const [giftInfo, wgDispatch] = useReducer(giftReducer, initialGiftLoad);

  const getLabelMsg = () => {
    let msg;
    const reward = giftInfo;
    if (!reward?.isBdatePresent) {
      return reward?.rewardNoBdate;
    }
    if (reward?.rewardAddedToCart) {
      return (msg = reward?.appliedToCartMsg);
    }
    if (reward?.rewardRedeemed) {
      return `${messages.AlreadyRedeemed}`;
    }
    if (!reward?.rewardEligible) {
      return reward?.rewardNotEligible;
    } else {
      return (msg = "");
    }
    return null;
  };

  let giftLable = getLabelMsg();
  let giftEnable = false;
  if (giftInfo?.rewardEligible && !giftInfo?.rewardAddedToCart) {
    giftEnable = true;
  }

  let typeDisplay = giftInfo?.rewardType;
  return (

    <>
      {(!giftEnable && giftLable !== `${messages.AppliedToCart}`) && (<List
          title=""                     // you can add “Rewards” etc. if desired
          data={[{
            id: 'birthday-gift',
            leftSide: {
              // main text
              label: typeDisplay,      // “Welcome Gift” etc.
              // secondary text(s)
              subtitle: [{
                content: giftLable,    // eligibility / already-redeemed message
                color: 'TextCritical',
              }],
              // thumbnail (pick the first gift variant’s image if you have one)
              image: undefined,
            },
            // no interaction – row is disabled
            rightSide: {
              toggleSwitch: {
                value: false,
                disabled: true,
              }
            }
          }]}
           imageDisplayStrategy="always"
        />)}
      {name === 'iPad' ? <GiftImages
        title={typeDisplay}
        imagesArr={giftInfo?.variants}
        rewardType={"Birthday Gift"}
        giftLabel={giftLable}
        giftEnable={giftEnable}
        giftType={null}
      /> : <GiftImagesGo
        title={typeDisplay}
        imagesArr={giftInfo?.variants}
        rewardType={"Birthday Gift"}
        giftLabel={giftLable}
        giftEnable={giftEnable}
        giftType={null}
      />
      }
    </>
  );
};


