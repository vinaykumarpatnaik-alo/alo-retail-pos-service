import React, {
    useContext,
    useRef,
    useEffect,
    useState,
    startTransition,
  } from 'react';
  import {
    useApi,
    List,
    Icon, // ← only needed if you use a spinner icon
  } from '@shopify/ui-extensions-react/point-of-sale';
  import { SelectionContext } from '../context/SelectionContext';
  import { CartProvider, useCart } from '../../../../pos-cart-utils/context/CartProvider';
  
  export const GiftImagesGo = ({
    title,
    imagesArr,
    rewardType,
    giftLabel,
    giftEnable,
    giftType,
  }) => {
    /* ------------------------------------------------------------------ */
    /* Hooks & context                                                    */
    /* ------------------------------------------------------------------ */
    const api                 = useApi();
    const cart                = useCart();
    const { name: deviceName } = api.device;
  
    const { variantSelected, rDispatch, cartData } = useContext(SelectionContext);
  
    const pendingRef          = useRef<Record<string, boolean>>({});
    const lastDiscountIdsRef  = useRef<Set<string>>(new Set());
  
    const [processingVariant, setProcessingVariant] = useState<number | null>(null);
  
    /* ------------------------------------------------------------------ */
    /* Resolve “currently selected” variant for this reward type          */
    /* ------------------------------------------------------------------ */
    const { wdSelect, wgSelect, egSelect, bgSelect } = variantSelected ?? {};
    const giftSelected =
      {
        'Welcome 10% off': wdSelect,
        'Welcome Gift':    wgSelect,
        'Exclusive Gift':  egSelect,
        'Birthday Gift':   bgSelect,
      }[rewardType] ?? null;
  
    /* ------------------------------------------------------------------ */
    /* Helper → optimistic UI state update                                */
    /* ------------------------------------------------------------------ */
    const updateToggle = (checked: boolean, vId = 0, price = 0) =>
      startTransition(() =>
        rDispatch({ giftChecked: checked, variantId: vId, giftType: rewardType, price })
      );
  
    /* ------------------------------------------------------------------ */
    /* Main handler                                                       */
    /* ------------------------------------------------------------------ */
    const handleImageSelect = async (index: number) => {
      const key = rewardType;
      if (pendingRef.current[key]) return; // 🔒 already busy
  
      const giftClicked    = imagesArr[index];
      const clickedVariant = giftClicked?.variantId;
      const sameVariantId  = giftSelected?.variantId === clickedVariant;
  
      pendingRef.current[key] = true;
      setProcessingVariant(clickedVariant);   // show “Adding…” cue
  
      try {
        /* ---------- NON-DISCOUNT GIFTS ---------- */
        if (giftType !== 'discount') {
          const items = cart?.lineItems ?? [];
  
          if (sameVariantId) {
            /* Optimistic deselect */
            updateToggle(false);
            const li = items.find((l) => l.variantId === Number(clickedVariant));
            if (li?.uuid) await api.cart.removeLineItem(li.uuid);
          } else {
            /* Optimistic select */
            updateToggle(true, clickedVariant, giftClicked?.price);
  
            /* Remove prev gift in same bucket */
            if (giftSelected?.variantId) {
              const prev = items.find(
                (l) => l.variantId === Number(giftSelected.variantId)
              );
              if (prev?.uuid) await api.cart.removeLineItem(prev.uuid);
            }
            await api.cart.addLineItem(Number(clickedVariant), 1);
          }
          return;
        }
  
        /* ---------- DISCOUNT GIFTS ---------- */
        if (giftType === 'discount') {
          if (sameVariantId) {
            updateToggle(false);
            await api.cart.removeCartDiscount();
          } else {
            updateToggle(true, clickedVariant);
            await api.cart.addCartCodeDiscount(clickedVariant);
          }
        }
      } catch (err) {
        console.error('Gift op failed → rollback', err);
        updateToggle(false);
        api.toast.show('Couldn’t apply gift. Try again.', { duration: 3000 });
      } finally {
        setProcessingVariant(null);
        pendingRef.current[key] = false;
      }
    };
  
    /* ------------------------------------------------------------------ */
    /* Effect: apply line-item discounts & props                          */
    /* ------------------------------------------------------------------ */
    useEffect(() => {
      if (!cart?.lineItems?.length || !giftSelected) return;
  
      const idToUuid = Object.fromEntries(
        cart.lineItems.map((li) => [li.variantId, li.uuid])
      );
      const variants =
        giftSelected.variantsArr ??
        [{ variantId: giftSelected.variantId, price: giftSelected.price ?? 0 }];
  
      const label =
        {
          'Welcome Gift':   'Welcome Gift',
          'Exclusive Gift': 'Exclusive Gift',
          'Birthday Gift':  'Birthday Gift',
        }[giftSelected.giftType || giftSelected.desc] ?? 'Gift';
  
      variants.forEach(({ variantId, price = 0 }) => {
        const uuid = idToUuid[Number(variantId)];
        if (uuid && !lastDiscountIdsRef.current.has(uuid)) {
          api.cart
            .setLineItemDiscount(uuid, 'FixedAmount', label, price.toString())
            .then(() => {
              api.cart.addLineItemProperties(uuid, { _isLoyaltyGift: 'true' });
              lastDiscountIdsRef.current.add(uuid);
            })
            .catch((err) => console.error('Discount failed', err));
        }
      });
    }, [cart?.lineItems, giftSelected]);
  
    /* ------------------------------------------------------------------ */
    /* Small helpers                                                      */
    /* ------------------------------------------------------------------ */
    const MAX_LEN = deviceName === 'iPad' ? 34 : 28;
    const wrap    = (s = '') =>
      s.replace(/\([^)]*\)/, '').length <= MAX_LEN
        ? s.replace(/\([^)]*\)/, '')
        : s.replace(/\([^)]*\)/, '').match(new RegExp(`.{1,${MAX_LEN}}`, 'g')).join('\n');
  
    const styleTxt = (s = '') => (s.match(/\(([^)]+)\)/)?.[1] ?? '');
  
    const itemInCart = (vId: number) =>
      cartData?.lineItems?.some((i) => Number(i.variantId) === Number(vId));
  
    /* ------------------------------------------------------------------ */
    /* Build List data                                                    */
    /* ------------------------------------------------------------------ */
    if (!imagesArr?.length) return null;
  
    const listData = imagesArr.map((gift, idx) => {
      const isSelected   = giftSelected?.variantId === gift.variantId;
      const isDisabled   = !giftEnable;
      const isProcessing = processingVariant === gift.variantId;
  
      /* Subtitles */
      const subs: { content: string; color: string }[] = [
        { content: title, color: isSelected ? 'TextSuccess' : isDisabled ? 'TextDisabled' : 'TextSubdued' },
      ];
  
      if (giftLabel) {
        const alreadyApplied = giftLabel === 'Already applied to Cart';
        const show =
          (giftType !== 'discount' && giftLabel) ||
          (alreadyApplied && itemInCart(gift.variantId));
        if (show) {
          subs.push({
            content: ` ${giftLabel}`,
            color: 'TextCritical',
          });
        }
      }
  
      if (giftType !== 'discount') {
        const st = styleTxt(gift.imageAltText);
        subs.push({ content: st ? `Style: ${st}` : '\u00A0', color: 'TextSubdued' });
      } else {
        subs.push({ content: `${gift.variantId}`, color: 'TextSubdued' });
      }
  
      /* “Adding / Removing” line */
      if (isProcessing)
        subs.push({
          content: isSelected ? 'Updating' : 'Adding…',
          color: 'TextSubdued',
        });
  
      /* Right-side UI */
      const rightSide = isProcessing
        ? {
            icon: { source: 'spinner' as any }, // fallback: { source: 'info' }
          }
        : {
            toggleSwitch: {
              value: isSelected,
              disabled: isDisabled || !!processingVariant,
            },
          };
  
      return {
        id: gift.variantId?.toString() ?? idx.toString(),
        leftSide: {
          label: wrap(gift.imageAltText),
          subtitle: subs,
          image: gift.image ? { source: gift.image } : undefined,
        },
        rightSide,
        onPress:
          isDisabled || isProcessing ? undefined : () => handleImageSelect(idx),
      };
    });
  
    /* ------------------------------------------------------------------ */
    /* Render                                                             */
    /* ------------------------------------------------------------------ */
    return (
      <CartProvider>
        <List title="" data={listData} imageDisplayStrategy="automatic" />
      </CartProvider>
    );
  };
  