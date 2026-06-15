
import React, { useReducer, useRef } from "react";
import {
  Text, Stack, Image, Section, Selectable, useApi,List
} from '@shopify/ui-extensions-react/point-of-sale';

import { GiftImages } from "./GiftImages";
import { GiftImagesGo } from "./GiftImagesGo";


export const giftReducer = (state, action) => {
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

export const WelcomeGift = ({ customerInfo, cartData, messages }) => {
  const api = useApi();
  const { name, getDeviceId } = useApi().device;
  const extractGiftLimits = () => {
    
    const gifts = customerInfo?.gifts || [];
    let giftLimit = 0;
    const giftVariants = [];

    for (let i = 0; i < gifts?.length; i++) {
      let gift = gifts[i];
      if (gift?.gift_type === "welcome_gift") {
        // api.toast.show(JSON.stringify('sdddf'),{duration:3000})
        giftLimit = gift?.amount_to_spend || 0;
        let gwcCard = {};
        gwcCard.variantId = gift?.variant_id || 0;
        gwcCard.productId = gift?.product_id || 0;
        gwcCard.amountToSpend = gift?.amount_to_spend || 0;
        gwcCard.image = gift?.image || null;
        gwcCard.imageAltText = gift?.image_alt_text || "";
        gwcCard.price = gift?.price;
        giftVariants.push(gwcCard);
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
          //api.toast.show(JSON.stringify(giftPresent),{duration:3000})
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
    if (cartData) {
      const welcomeGiftTag = "HasPurchasedWelcomeGift";
      isGiftRedeemed = customerInfo?.tags?.includes(welcomeGiftTag);
      if (
        !isGiftRedeemed &&
        (customerInfo?.loyaltyInfo?.loyalty_tier?.toLowerCase() ===
          "tier1"?.toLowerCase() ||
          customerInfo?.loyaltyInfo?.loyalty_tier?.toLowerCase() ===
          "tier2"?.toLowerCase() ||
          customerInfo?.loyaltyInfo?.loyalty_tier?.toLowerCase() ===
          "tier3"?.toLowerCase())
      ) {
        isGiftEligible = true;
      } else {
        isGiftEligible = false;
      }
    }

    const isAddedToCart = checkCartForGift(giftVariants, "Welcome Gift");

    return {
      isGiftEligible: isGiftEligible,
      isGiftRedeemed: isGiftRedeemed,
      isAddedToCart: isAddedToCart,
      giftLimit: giftLimit,
      giftVariants: giftVariants,
    };
  };

  const collectOtherGiftDetails = () => {
    const cartLineItems = cartData?.lineItems || [];
    let exclusionTotal = 0;
    const exclusionList = customerInfo?.exclusionList || [];
    for (let i = 0; i < cartLineItems?.length; i++) {
      let lineItem = cartLineItems[i];
      if (lineItem?.isGiftCard) {
        exclusionTotal += lineItem?.price * lineItem?.quantity || 0;
      }
    }
    if (isNaN(exclusionTotal)) {
      exclusionTotal = 0;
    }
  
    return exclusionTotal;
  };


  let giftFlags = null;
  let subTotalMinusGifts = 0;
  const giftRef = useRef(true);
  if (giftRef.current) {
    giftFlags = validateGift();
    giftRef.current = false;
    const exclusionTotal = collectOtherGiftDetails();
    subTotalMinusGifts = cartData?.subtotal - exclusionTotal;
  }
  const initialGiftLoad = {
    appliedToCartMsg: `${messages.AppliedToCart}`,
    subtotal: subTotalMinusGifts,
    rewardType: "Welcome Gift",
    rewardEligible: giftFlags?.isGiftEligible || false,
    rewardAddedToCart: giftFlags?.isAddedToCart || false,
    rewardRedeemed: giftFlags?.isGiftRedeemed || false,
    rewardEligibleDesc: giftFlags?.giftLimit
      ? `${messages.ordersAbove} ${giftFlags?.giftLimit}`
      : `${messages.ordersAbove} $150`,
    rewardNotEligible: `${messages.AlreadyRedeemed}`,
    type: "gift",
    desc: "Welcome Gift",
    amountToSpend: giftFlags?.giftLimit || 0,
    variants: giftFlags?.giftVariants || [],
  };

  const [giftInfo, wgDispatch] = useReducer(giftReducer, initialGiftLoad);

  const getLabelMsg = () => {
    let msg;
    const reward = giftInfo;
    if (reward?.rewardRedeemed) {
      return `${messages.AlreadyRedeemed}`;
    }
    if (reward?.rewardAddedToCart) {
      return (msg = reward?.appliedToCartMsg);
    }
    if (giftInfo?.subtotal >= giftInfo?.amountToSpend) {
      return (msg = "");
    }
    if (
      reward?.rewardType === "Welcome Gift" &&
      reward?.rewardEligible &&
      giftInfo?.subtotal < giftInfo?.amountToSpend
    ) {
      return reward?.rewardEligibleDesc;
    }
    return null;
  };

  let giftLable = getLabelMsg();
  let giftEnable = false;
  if (
    giftInfo?.rewardEligible &&
    +giftInfo?.subtotal >= giftInfo?.amountToSpend &&
    !giftInfo?.rewardAddedToCart
  ) {
    giftEnable = true;
  }
  let typeDisplay = giftInfo?.rewardType;
  return (

    <>
  
    {(!giftEnable && giftLable !== `${messages.AppliedToCart}` && !(giftLable.includes(`${messages.ordersAbove}`))) && (<List
    title=""                     // you can add “Rewards” etc. if desired
    data={[{
      id: 'welcome-gift',
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
      {name === 'iPad' ?
        <GiftImages
          title={typeDisplay}
          imagesArr={giftInfo?.variants}
          rewardType={"Welcome Gift"}
          giftLabel={giftLable}
          giftEnable={giftEnable}
          giftType={null}
        /> :
        <GiftImagesGo
          title={typeDisplay}
          imagesArr={giftInfo?.variants}
          rewardType={"Welcome Gift"}
          giftLabel={giftLable}
          giftEnable={giftEnable}
          giftType={null}
        />
      }

    </>
  );
};


