import React, { useContext, useRef, useEffect } from "react";
import {
  useApi,
  Icon,
  Image,
  Stack,
  Text,
  List,
} from '@shopify/ui-extensions-react/point-of-sale';
import { SelectionContext } from "../context/SelectionContext";
import { CartProvider, useCart } from "../../../../pos-cart-utils/context/CartProvider";

/**
 * GiftImages component (List‑based implementation)
 * ‑ Behaviour and business logic are unchanged.
 */
export const GiftImages = ({
  title,
  imagesArr,
  rewardType,
  giftLabel,
  giftEnable,
  giftType,
}) => {
  /* ------------------------------------------------------------------ */
  /* Hooks & setup                                                      */
  /* ------------------------------------------------------------------ */
  const api = useApi();
  const cart = useCart();
  const lastDiscountedIdsRef = useRef(new Set());
  const {
    name: deviceName,
  } = api.device;

  /* Local & global context */
  const { customerInfo, cartData } = useContext(SelectionContext);
  const { variantSelected, rDispatch } = useContext(SelectionContext);

  /* ------------------------------------------------------------------ */
  /* Helper: resolve current selection for this reward type             */
  /* ------------------------------------------------------------------ */
  const { wdSelect, wgSelect, egSelect, bgSelect } = variantSelected || {};
  let giftSelected = null;
  switch (rewardType) {
    case "Welcome 10% off":
      giftSelected = wdSelect;
      break;
    case "Welcome Gift":
      giftSelected = wgSelect;
      break;
    case "Exclusive Gift":
      giftSelected = egSelect;
      break;
    case "Birthday Gift":
      giftSelected = bgSelect;
      break;
    default:
      giftSelected = null;
  }

  /* ------------------------------------------------------------------ */
  /* Event handler                                                      */
  /* ------------------------------------------------------------------ */
  const handleImageSelect = (index) => {
    const giftClicked = imagesArr[index];
    const clickedVariant = giftClicked?.variantId;
    const sameVariantId = giftSelected?.variantId == clickedVariant;

    /* --- Non‑discount gifts ---------------------------------------- */
    if (giftType !== 'discount') {
      const lineItemsArr = cart?.lineItems || [];
      /* Remove previous gift (if any) */
      if (sameVariantId) {
        const lineItemWithVariant = lineItemsArr.find((li) => li.variantId === Number(clickedVariant));
        if (lineItemWithVariant?.uuid) api.cart.removeLineItem(lineItemWithVariant.uuid);
        rDispatch({ giftChecked: false, variantId: 0, giftType: rewardType, price: 0 });
      } else {
        /* Remove previously chosen variant before adding new */
        if (giftSelected?.variantId) {
          const prev = lineItemsArr.find((li) => li.variantId === Number(giftSelected.variantId));
          if (prev?.uuid) {
            api.cart.removeLineItem(prev.uuid);
            lastDiscountedIdsRef.current.delete(prev.uuid);
          }
        }
        api.cart.addLineItem(Number(clickedVariant), 1);
        rDispatch({
          giftChecked: true,
          variantId: clickedVariant,
          giftType: rewardType,
          price: giftClicked?.price,
        });
      }
      return;
    }

    /* --- Discount gifts (cart‑wide code) --------------------------- */
    if (giftType === 'discount') {
      if (sameVariantId) {
        api.cart.removeCartDiscount().catch(console.error);
        rDispatch({ giftChecked: false, variantId: 0, giftType: rewardType, price: 0 });
      } else {
        api.cart.addCartCodeDiscount(clickedVariant);
        rDispatch({ giftChecked: true, variantId: clickedVariant, giftType: rewardType, price: 0 });
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Helpers: text wrapping & style extraction                          */
  /* ------------------------------------------------------------------ */
  const MAX_LENGTH = deviceName === 'iPad' ? 34 : 28;
  const wrapText = (str) => {
    if (!str) return '';
    const txt = str.replace(/\([^)]*\)/, '');
    if (txt.length <= MAX_LENGTH) return txt;
    return txt.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'g')).join('\n');
  };
  const addStyle = (str = '') => {
    const m = str.match(/\(([^)]+)\)/);
    return m ? m[1] : '';
  };
  const checkGiftItemPresentInCart = (variantId) =>
    cartData?.lineItems?.some((i) => Number(i.variantId) === Number(variantId));

  /* ------------------------------------------------------------------ */
  /* Effect: apply line‑item discounts & properties                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!cart?.lineItems?.length || !giftSelected) return;

    const variantToUuid = Object.fromEntries(cart.lineItems.map((li) => [li.variantId, li.uuid]));
    const variantsArr = giftSelected.variantsArr ?? [
      { variantId: giftSelected.variantId, price: giftSelected.price ?? 0 },
    ];

    /* Label for setLineItemDiscount */
    const giftTypeLabel = {
      'Welcome Gift': 'Welcome Gift',
      'Exclusive Gift': 'Exclusive Gift',
      'Birthday Gift': 'Birthday Gift',
    }[giftSelected.giftType || giftSelected.desc] || 'Gift';

    variantsArr.forEach(({ variantId, price = 0 }) => {
      const uuid = variantToUuid[Number(variantId)];
      if (uuid && !lastDiscountedIdsRef.current.has(uuid)) {
        api.cart
          .setLineItemDiscount(uuid, 'FixedAmount', giftTypeLabel, price.toString())
          .then(() => {
            api.cart.addLineItemProperties(uuid, { _isLoyaltyGift: 'true' });
            lastDiscountedIdsRef.current.add(uuid);
          })
          .catch((err) => console.error('Discount failed', err));
      }
    });
  }, [cart?.lineItems, giftSelected]);

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  if (!imagesArr?.length) return null;

  const listData = imagesArr.map((giftImage, index) => {
    /* Selection / disable logic  ----------------------------------- */
    const isSelected = giftSelected?.variantId === giftImage.variantId;
    const isDisabled = !giftEnable;

    /* --- Colors ---------------------------------------------------- */
    const textColor = isSelected
      ? 'TextSuccess'
      : isDisabled
      ? 'TextDisabled'
      : 'TextNeutral';
    const subtitleColor = isSelected
      ? 'TextSuccess'
      : isDisabled
      ? 'TextDisabled'
      : 'TextSubdued';

    /* --- Subtitle content ----------------------------------------- */
    const subtitleArr = [];

    // Primary title (original `title` prop)
    subtitleArr.push({ content: `${title}`, color: subtitleColor });

    // Gift label variations
    if (giftLabel) {
      const alreadyApplied = giftLabel === 'Already applied to Cart';
      const showLabel =
        (giftType !== 'discount' && giftLabel) ||
        (alreadyApplied && checkGiftItemPresentInCart(giftImage.variantId));
      if (showLabel) {
        subtitleArr.push({
          content: ` ${giftLabel}`,
          color: alreadyApplied ? 'TextCritical' : 'TextCritical',
        });
      }
    }

    // Extra line for style (non‑discount gifts)
    if (giftType !== 'discount') {
      const styleTxt = addStyle(giftImage.imageAltText);
      subtitleArr.push({
        content: styleTxt ? `Style: ${styleTxt}` : '\u00A0',
        color: subtitleColor,
      });
    } else {
      /* Discount list shows variantId */
      subtitleArr.push({
        content: `${giftImage.variantId}`,
        color: subtitleColor,
      });
    }

    return {
      id: giftImage.variantId?.toString() ?? index.toString(),
      leftSide: {
        label:
          giftType !== 'discount'
            ? wrapText(giftImage.imageAltText)
            : wrapText(giftImage.imageAltText),
        subtitle: subtitleArr,
        image: giftImage.image ? { source: giftImage.image } : undefined,
      },
      rightSide: {
        toggleSwitch: {
          value: isSelected,
          disabled: isDisabled,
        },
      },
      onPress: isDisabled ? undefined : () => handleImageSelect(index),
    };
  });

  return (
    <CartProvider>
      <List
        title={''}
        data={listData}
        imageDisplayStrategy="automatic"
      />
    </CartProvider>
  );
};
