// RewardImages.tsx
import {
  Icon,
  Image,
  List,
  Section,
  Selectable,
  Stack,
  Text,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { LOYALTY_REWARD } from '../constants';
import { SelectionContext } from '../context/SelectionContext';
import { useCart } from '../../../../pos-cart-utils/context/CartProvider';

/* -------------------------------------------------------- */
/*  🔑  Utilities                                           */
/* -------------------------------------------------------- */
const breakLines = (str: string, width: number): string =>
  str.replace(new RegExp(`(.{1,${width}})`, 'g'), '$1\n');

/* -------------------------------------------------------- */
/*  🔑  Component                                           */
/* -------------------------------------------------------- */
export const RewardImages = React.memo(
  ({ imagesArr, rewardType, latestPoints, messages }) => {
    const api = useApi();
    const { name } = api.device;
    const cart = useCart();
    const lastDiscountedIdsRef = useRef<Set<string>>(new Set());

    /* ---------- state from context ---------- */
    const { variantSelected, rDispatch } = useContext(SelectionContext);
    const rewardSelected =
      rewardType === 'Loyalty Reward'
        ? variantSelected.llRewardsSelect
        : null;

    /* ---------- helper maps ---------- */
    const variantToUuid = useMemo(() => {
      if (!cart?.lineItems?.length) return {};
      const map: Record<number, string> = {};
      for (const { variantId, uuid } of cart.lineItems) {
        map[variantId] = uuid;
      }
      return map;
    }, [cart?.lineItems]);

    /* ---------- apply / clean discounts ---------- */
    useEffect(() => {
      if (!cart?.lineItems?.length || !rewardSelected?.variantsArr?.length)
        return;

      rewardSelected.variantsArr.forEach(
        ({ variantId, rewardId, points, price = 0 }) => {
          const uuid = variantToUuid[Number(variantId)];
          if (!uuid || lastDiscountedIdsRef.current.has(uuid)) return;

          api.cart
            .setLineItemDiscount(
              uuid,
              'FixedAmount',
              'Loyalty Reward',
              price.toString()
            )
            .then(() => {
              api.cart.addLineItemProperties(uuid, {
                _LoyaltyReward: `${rewardId}|${points}`,
              });
              lastDiscountedIdsRef.current.add(uuid);
            })
            .catch((err) =>  console.error(err));
        }
      );
    }, [api.cart, variantToUuid, rewardSelected?.variantsArr]);

    const handleImageSelect = useCallback(
      async (rewardImage) => {
        const clicked = rewardImage.variantId?.toString();
        if (!clicked) return;

        const alreadyChosen = rewardSelected?.variantsArr?.some(
          (v) => v.variantId?.toString() === clicked
        );

        /* --- 1️⃣  build the optimistic list --- */
        const optimisticArr = alreadyChosen
          ? rewardSelected.variantsArr.filter(
              (v) => v.variantId?.toString() !== clicked
            )
          : [
              ...(rewardSelected?.variantsArr ?? []),
              {
                variantId: clicked,
                points: rewardImage.point_cost,
                rewardId: rewardImage.id,
                isUserAdded: true,
                price: rewardImage.price,
              },
            ];

        /* --- 2️⃣  push to UI first --- */
        rDispatch({
          giftChecked: optimisticArr.length > 0,
          variantsArr: optimisticArr,
          giftType: rewardType,
        });

        try {
          /* --- 3️⃣  background cart update --- */
          if (alreadyChosen) {
            const li = cart.lineItems.find(
              (l) => l.variantId?.toString() === clicked
            );
            if (li?.uuid) await api.cart.removeLineItem(li.uuid);
          } else {
            await api.cart.addLineItem(Number(clicked), 1);
          }
        } catch (err) {
          /* --- 4️⃣  rollback on failure --- */
          __DEV__ && console.error(err);
          rDispatch({
            giftChecked: rewardSelected?.variantsArr?.length > 0,
            variantsArr: rewardSelected?.variantsArr ?? [],
            giftType: rewardType,
          });
          api.toast.show(
            messages?.SomethingWentWrong ?? 'Cart update failed',
            { duration: 3000 }
          );
        }
      },
      [api.cart, cart.lineItems, rewardSelected?.variantsArr, rDispatch, rewardType]
    );

    /* ---------- list rows ---------- */
    const listData = useMemo(() => {
      const selectedIds = rewardSelected?.variantsArr?.map((v) =>
        v.variantId?.toString()
      );

      return imagesArr.map((rewardImage) => {
        const idStr = rewardImage.variantId?.toString();
        const isSelected = selectedIds?.includes(idStr);
        const notEnoughPts = rewardImage.point_cost > latestPoints;
        const disabled = !isSelected && notEnoughPts;

        return {
          id: idStr,
          leftSide: {
            label: rewardImage.imageAltText,
            subtitle: [
              {
                content: `${rewardImage.point_cost} Points${
                  disabled ? ` | ${messages.MorePointsNeeded}` : ''
                }`,
                color: isSelected
                  ? 'TextSuccess'
                  : disabled
                  ? 'TextCritical'
                  : 'TextSubdued',
              },
              {
                content: rewardImage.style
                  ? `Style: ${rewardImage.style}`
                  : '\u00A0',
                color: isSelected
                  ? 'TextSuccess'
                  : disabled
                  ? 'TextDisabled'
                  : 'TextSubdued',
              },
            ],
            image: rewardImage.image
              ? { source: rewardImage.image }
              : undefined,
          },
          rightSide: {
            toggleSwitch: {
              value: isSelected,
              disabled,
            },
          },
          onPress: disabled ? undefined : () => handleImageSelect(rewardImage),
        };
      });
    }, [imagesArr, latestPoints, messages.MorePointsNeeded, rewardSelected?.variantsArr, handleImageSelect]);

    /* ---------- render ---------- */
    const maxLen = name === 'iPad' ? 28 : 20;

    return (
      listData.length > 0 && (
        <List title="" data={listData} imageDisplayStrategy="automatic" />
      )
    );
  }
);
