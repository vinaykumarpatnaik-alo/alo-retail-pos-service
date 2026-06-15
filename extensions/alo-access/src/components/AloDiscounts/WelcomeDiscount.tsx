
import React, { useReducer, useRef } from "react";
import { GiftImages } from "../AloGifts/GiftImages";
import {
  Stack
} from '@shopify/ui-extensions-react/point-of-sale';

const discountReducer = (state, action) => {
 
  const { type, payload } = action;
  switch (type) {
    case "LOADDISCOUNTDATA":
      let tempDiscountDetails = state.welcomeDiscountData;
      tempDiscountDetails.discountEligible = payload?.isDiscountEligible;
      tempDiscountDetails.discountAddedToCart = payload?.isAddedToCart;
      tempDiscountDetails.discountRedeemed = payload?.isDiscountRedeemed;

      return {
        ...state,
        welcomeDiscountData: tempDiscountDetails,
      };

    default:
      return { ...state };
  }
};

export const WelcomeDiscount = ({ customerInfo, cartData }) => {
  
  const validateWelcomeDiscount = (existingUser, discountItem) => { 
    let isDiscountEligible = false;
    let isDiscountRedeemed = false;
    if (cartData) {
      if (
        discountItem?.title?.toLowerCase() === "Welcome 10% off".toLowerCase()
      ) {
        const welcomeDiscountTag = "HasRedeemedLoyaltyWelcomeDiscount";
        isDiscountRedeemed = existingUser?.tags?.includes(welcomeDiscountTag);
      }
      if (!isDiscountRedeemed) {
        isDiscountEligible = true;
      } else {
        isDiscountEligible = false;
      }
    }

    const cDiscounts = cartData?.cartDiscount;
    let discountPresent = false;
    if (
      cDiscounts &&
      cDiscounts?.discountDescription === discountItem?.discountCode
    ) {
      discountPresent = true;
    }

    return {
      isDiscountEligible: isDiscountEligible,
      isDiscountRedeemed: isDiscountRedeemed,
      isAddedToCart: discountPresent,
    };
  };

  const discountRef = useRef(true);
  let initialDiscountLoad = null;
  if (discountRef.current) {
    discountRef.current = false;
    const giftItems = customerInfo?.gifts;
    let discountItem = null;
    for (let i = 0; i < giftItems?.length; i++) {
      let item = giftItems[i];
      if (item?.gift_type?.toLowerCase() === "discount".toLowerCase()) {
        discountItem = item;
        break;
      }
    }
    
    const { isDiscountEligible, isDiscountRedeemed, isAddedToCart } =
      validateWelcomeDiscount(customerInfo, discountItem);

    initialDiscountLoad = {
      appliedToCartMsg: "Already applied to Cart",
      discountItem: discountItem,
      welcomeDiscountData: {
        discountType: discountItem?.title,
        discountNotEligible: "Customer already redeemed gift",
        discountEligibleDesc: "",
        discountEligible: isDiscountEligible,
        discountAddedToCart: isAddedToCart,
        discountRedeemed: isDiscountRedeemed,
      },
      discountGiftGiftCard: {
        type: "discount",
        value: {
          discountCode: discountItem?.discountCode,
          desc: discountItem?.title,
        },
        variants: [],
      },
    };
  }

  const [discountInfo, discountDispatch] = useReducer(
    discountReducer,
    initialDiscountLoad
  );
  
  //api.toast.show(JSON.stringify(discountInfo),{duration:3000})

  const createDiscountUI = () => {
    //create the discount variants
    const discountVariants = [];
    const giftsData = customerInfo?.gifts || [];
   
    if (giftsData?.length > 0) {
      for (let i = 0; i < giftsData?.length; i++) {
        const gift = giftsData[i];
        if (gift?.gift_type === "discount") {
          //api.toast.show(JSON.stringify(gift),{duration:3000})
          let wc10Card = {};
          wc10Card.variantId = gift?.discountCode || 0;
          wc10Card.image = "https://i.ibb.co/wcxv5j8/welcome10offimg.jpg";
          wc10Card.imageAltText = gift?.title;
          // console.log("[DISCOUNT] wc10Card:", wc10Card);
          discountVariants.push(wc10Card);
          // continue;
        }
      }
    }
    
    return discountVariants;
  };
  const discountsArr = createDiscountUI();
  let discountEnable = false;
  if (
    discountInfo?.welcomeDiscountData?.discountEligible &&
    !cartData?.cartDiscount &&
    !discountInfo?.welcomeDiscountData?.discountAddedToCart
  ) {
    discountEnable = true;
  }
  const typeDisplay = "Discount";

  const getLabelMsg = () => {
    let msg;
    const discount10 = discountInfo?.welcomeDiscountData;
    const cDiscounts = cartData?.cartDiscount;
    const { discountItem } = discountInfo;
    
    if (discount10?.discountRedeemed) {
      
      return "Customer already redeemed";
    }
    if (discount10?.discountAddedToCart) {
      
      return (msg = discountInfo?.appliedToCartMsg);
    }
    if (discount10?.discountEligible && cDiscounts) {
      
      if (cDiscounts?.discountDescription !== discountItem?.title) {
        
        return "Discount cannot be combined";
      }
    }
    if (!discount10?.discountEligible) {
     
      return discount10?.discountNotEligible;
    } else {
      
      return (msg = "");
    }
  };
  const discountLabel = getLabelMsg();

  return (

    
      <Stack direction="inline">
        {/* {(!discountEnable && discountLabel!=='Already applied to Cart')  && <Text children={`${typeDisplay}:`} variant='captionRegular' color={discountEnable ? "TextNeutral" : "TextDisabled"} />}
      {(!discountEnable && discountLabel!=='Already applied to Cart') && <Text children={discountLabel}  variant='body' color="TextDisabled"/>} */}

        <GiftImages
          title={typeDisplay}
          imagesArr={discountsArr}
          rewardType={"Welcome 10% off"}
          giftLabel={discountLabel}
          giftEnable={discountEnable}
          giftType={'discount'}
        />

      </Stack>

  );
};
