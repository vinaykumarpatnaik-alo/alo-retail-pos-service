import React, { useEffect, useState } from 'react';

import {
  Tile, useApi,
  useLocaleSubscription, reactExtension
} from '@shopify/ui-extensions-react/point-of-sale'
import {CartProvider, useCart } from '../../pos-cart-utils/context/CartProvider';

const SmartGridTile = () => {
  const api = useApi<'pos.home.tile.render'>();
  const cartDet  = useCart();  
  const locale = useLocaleSubscription();

  const { currentSession, getSessionToken } = useApi().session;
  const { shopDomain, locationId } = currentSession;
  let host = "";
  if (shopDomain.includes('dev') || shopDomain.includes('test') || shopDomain.includes('it-aloyoga')) {
    host = "https://alo.pos.shopifyapps.dev.alo.software";
  } else {
    host = "https://alo.pos.shopifyapps.alo.software";
  }
  const [gwpData, setGwpData] = useState({
    variantId: null,
    gwpLimit: 0,
    tileName: '',
    gwpEnabled: false,
    subtilte: '',
    autoApply: false
  });
  const [isEnabled, setIsEnabled] = useState(false);
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [lineItemQuantity, setLineItemQuantity] = useState(0);
  const [isAddingGWP, setIsAddingGWP] = useState(false);

  //Call get gwp details api when there is change in length of cart items

  useEffect(() => {
    const fetchGWPdata = async () => {
      const token = await api.session.getSessionToken(); // Replace with your token
      const url = `${host}/pos/v1/gwp/data?locale=${locale}`;

      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        api.toast.show(`GWP data fetch failed....`, { duration: 3000 });
        return;
      }

      const result = await response.json();
      const extractedData = result?.payload;
      if (extractedData !== null) {
        let tileName = extractedData.tile_name;
        let subTitle = "";
        const delimiter = "|";
        if (tileName.includes(delimiter)) {
          const splittedArr = tileName.split(delimiter);
          tileName = splittedArr[0];
          subTitle = splittedArr[1];
        }
        setGwpData({
          variantId: extractedData.gwpvariant,
          gwpLimit: Number(extractedData.gwplimit),
          tileName: tileName,
          gwpEnabled: extractedData.enabled,
          subtilte: subTitle,
          autoApply: extractedData.autoApply
        });

      }
      else {
        api.toast.show(`GWP Data fetch has no data...`, { duration: 3000 });
      }
    };
    fetchGWPdata();
  }, [cartDet?.lineItems?.length]);

  //Check gift quantity in inventory

  useEffect(() => {
    if (gwpData.variantId) {
      const fetchInventoryQuantity = async () => {
        const token = await api.session.getSessionToken(); // Replace with your token
        const url = `${host}/pos/v1/inventory/quantity?variantId=${gwpData.variantId}&locationId=${locationId}`;

        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          api.toast.show(`GWP Inventory fetch failed`, { duration: 3000 });
          return;
        }

        const result = await response.json();
        if (result?.payload) {
          setAvailableQuantity(result?.payload?.availableQuantity);
        } else {
          setAvailableQuantity(0);
        }
      };
      fetchInventoryQuantity();
    }
  }, [gwpData])


  const sumOfGiftCardPrices = (data) => {
    let sum = 0;
    data.forEach(item => {
      if (item.isGiftCard) {
        sum += item.price * item.quantity;
      }
    });
    return sum;
  }


  // Helper Function
  const addLineItemPropAndDiscount = (lineItemWithVariant) => {
    const lineItemProperty = {
      _isGWP: "true"
    }

    api.cart.addLineItemProperties(lineItemWithVariant.uuid, lineItemProperty).then(() => {
      let price = lineItemWithVariant.price * lineItemWithVariant.quantity;
      api.cart.setLineItemDiscount(
        lineItemWithVariant.uuid,
        'FixedAmount',
        'GWP Discount',
        JSON.stringify(price)
      ).then(() => {
        setApplyDiscount(false)
      });
    })
  }
  // Apply Discount once lineitem is added

  useEffect(() => {
    if (applyDiscount) {
      const lineItemsArr = cartDet.lineItems;
      const lineItemWithVariant = lineItemsArr.find(
        (lineItem) => lineItem.variantId === Number(gwpData.variantId)
      );
      addLineItemPropAndDiscount(lineItemWithVariant)
    }
  }, [applyDiscount])

  //set Lineitem Quantity when there is change in cart lineitems
  useEffect(() => {
    if (cartDet?.lineItems) {
      const total = cartDet.lineItems.reduce((sum, item) => sum + item.quantity, 0);
      setLineItemQuantity(total);
    }

  }, [cartDet?.lineItems])

  //Exclude gift and rewards in subtotal
  const calculateAdjustedSubTotal = (lineItems, subtotal) => {
    const sumOfGiftCard = Number(sumOfGiftCardPrices(lineItems));
    let adjustedSubTotal = Number(subtotal) - sumOfGiftCard;

    const containsGift = lineItems.filter(item => item.properties?._isLoyaltyGift === 'true');
    const totalGiftPrice = containsGift.reduce((sum, item) => sum + Number(item?.price), 0);
    if (containsGift.length) {
      adjustedSubTotal -= totalGiftPrice;
    }

    const rewardItems = lineItems.filter(item => item.properties?._LoyaltyReward);
    const totalRewardPrice = rewardItems.reduce((sum, item) => sum + Number(item?.price), 0);
    if (rewardItems.length) {
      adjustedSubTotal -= totalRewardPrice;
    }

    return adjustedSubTotal;
  };

  //Logic based on Lineitem Quantity dependency(subtotal dependency has issue with usecartsubscription)
  useEffect(() => {
    const lineItemsArr = cartDet.lineItems;
    const lineItemWithVariant = lineItemsArr.find(
      (lineItem) => lineItem.variantId === Number(gwpData.variantId)
    );
    const containsIsGWP = lineItemsArr.some(item => item.properties?._isGWP === 'true');
    const subTotal = calculateAdjustedSubTotal(lineItemsArr, cartDet?.subtotal);

    if (gwpData.gwpLimit !== 0 && subTotal >= gwpData.gwpLimit) {
      setIsEnabled(true);
      if (!lineItemWithVariant && !containsIsGWP && availableQuantity > 0 && !isAddingGWP && gwpData.autoApply) {
        addtoCart();
      }
    } else {
      setIsEnabled(false);
      if (lineItemWithVariant && containsIsGWP) {
        const uuidToRemove = lineItemWithVariant?.uuid;
        if (uuidToRemove) {
          api.cart.removeLineItem(uuidToRemove);
        }
      }
    }
  }, [lineItemQuantity, gwpData.gwpLimit]);

  //For removing gwp from cart depend on subtotal instead of lineitemQuantity(Usecartsubscription behavior)
  useEffect(() => {
    const lineItemsArr = cartDet.lineItems;
    const lineItemWithVariant = lineItemsArr.find(
      (lineItem) => lineItem.variantId === Number(gwpData.variantId)
    );
    const containsIsGWP = lineItemsArr.some(item => item.properties?._isGWP === 'true');
    const subTotal = calculateAdjustedSubTotal(lineItemsArr, cartDet?.subtotal);
    if (gwpData.gwpLimit !== 0 && subTotal < gwpData.gwpLimit) {
      if (lineItemWithVariant && containsIsGWP) {
        const uuidToRemove = lineItemWithVariant?.uuid;
        if (uuidToRemove) {
          api.cart.removeLineItem(uuidToRemove);
        }
      }
    }
  }, [cartDet?.subtotal])

  const addtoCart = async () => {
    if (isAddingGWP) return; //prevent multiple add usecartsubscription  issue
    setIsAddingGWP(true);
    const subTotal = calculateAdjustedSubTotal(cartDet.lineItems, cartDet?.subtotal);
    if (subTotal >= gwpData.gwpLimit) {
      await api.cart.addLineItem(Number(gwpData.variantId), 1);
      setApplyDiscount(true);
      setIsAddingGWP(false);
    }
  };

  return (
    <Tile
      title={gwpData.tileName}
      subtitle={gwpData.subtilte && gwpData.subtilte}
      onPress={addtoCart}
      destructive={isEnabled}
      enabled={isEnabled}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <CartProvider><SmartGridTile /></CartProvider>)
