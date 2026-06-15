import React, { useState, useEffect, useReducer, useRef, useMemo } from 'react';
import {
    Tile,
    reactExtension,
    useApi,
    useCartSubscription,
    useLocaleSubscription,
} from '@shopify/ui-extensions-react/point-of-sale';
import {
    UPDATE_CUSTOMERID,
    NO_CUSTOMERID,
    LOAD_CUSTOMERDATA,
    LOADING_CUSTOMERERROR,
    UPDATE_POINTSUSED,
    ALOTIER_1,
    ALOTIER_2,
    ALOTIER_3,
    LLTIER_1,
    LLTIER_2,
    LLTIER_3,
    PREORDER_END_DAYS
} from "./components/constants";
import ENjsonData from '../locales/en.json';
import FRcajsonData from '../locales/fr-ca.json';
import { CartProvider, useCart } from '../../pos-cart-utils/context/CartProvider';
import { useExtensionSession } from '../../shared/useExtensionSession';
import { ConfigProvider, useConfig } from '../../pos-cart-utils/context/ConfigProvider';

interface Birthday {
    month: string;
    day: string;
}

const customerReducer = (state, action) => {
    const { type, payload } = action;

    switch (type) {

        case UPDATE_CUSTOMERID:
            return {
                ...state,
                customerId: payload,
                isCartFetched: true,
                isError: false,
            };
        case UPDATE_POINTSUSED:
            return {
                ...state,
                rewardPointsSelected: payload,
                isCartFetched: true,
                isError: false,
            };
        case NO_CUSTOMERID:
            return {
                ...state,
                customerId: "",
                isCartFetched: true,
                isLoading: false,
                isError: false,
            };
        case LOAD_CUSTOMERDATA:
            return {
                ...state,
                customerData: payload,
                isLoading: false,
                isError: false,
            };
        case LOADING_CUSTOMERERROR:
            return { ...state, isError: true, isLoading: false };
        default:
            return { ...state };
    }
};

const SmartGridTile = () => {
    const api = useApi();
    const cart = useCart();
    const locale = useLocaleSubscription();
    const { host, token, shopDomain, locationId } = useExtensionSession(api);
    const [messages, setMessages] = useState<any>('');

    const [customerBday, setCustomerBday] = useState<Birthday>({ month: '', day: '' });
    const [preorderCheckConfig, setPreoderCheckConfig] = useState<any>(null);
    // This will hold any birthday message to display
    const [birthdayMessage, setBirthdayMessage] = useState<string>("");
    const [giftsData, setGiftsData] = useState<any>(null);
    const [availableQuantity, setAvailableQuantity] = useState(0);
    const [customerData, setCustomerData] = useState<any>('');
    const [scanDiscountDataConfig, setScanDiscountDataConfig] = useState<any>(null);
    const [discountApplied, setDiscountApplied] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Get config from context
    const configState = useConfig();
    const { flags, refreshFlags } = configState;
    const showAloAccessOptIn = flags.showAloAccessOptIn;

    // Unique variant ids from cart
    const variantIds = useMemo(() => {
        const items = (cart?.lineItems ?? []) as any[];
        const ids = items
            .map((it) => String(it?.variantId ?? it?.variantID ?? '').trim())
            .filter(Boolean);
        return Array.from(new Set(ids));
    }, [cart]);


    // --- helpers: build props in required format -------------------------------
    const pickPayload = (data: any) => (data?.payload ? data.payload : data);

    const hasPreorderTag = (p: any) =>
        Array.isArray(p?.product?.tags) &&
        p.product.tags.some((t: string) => /^\s*pre[-\s]?order\s*$/i.test(String(t)));

    const getEstimatedShipDateISO = (p: any): string | null => {
        const edges = p?.variant?.variantPreorder?.edges ?? [];
        for (const e of edges) {
            const node = e?.node;
            if (node?.key === 'estimated_ship_date' && node?.value) {
                return String(node.value); // e.g. "2025-10-30"
            }
        }
        return null;
    };

    const isPreorder = (raw: any) => {
        const p = pickPayload(raw);
        return hasPreorderTag(p) && Boolean(getEstimatedShipDateISO(p));
    };

    // Title to use as the property key (product – variant if both present)
    const buildDisplayTitle = (p: any) => {
        const prod = p?.product?.title?.trim() ?? '';
        const vari = p?.variant?.title?.trim() ?? '';
        if (prod && vari && !prod.includes(vari)) return `${prod} - ${vari}`;
        return prod || vari || 'Preorder Item';
    };



    // Parse "YYYY-MM-DD" as a UTC date (no TZ drift)
    const parseIsoDateOnly = (iso?: string | null): Date | null => {
        if (!iso) return null;
        const [y, m, d] = iso.split("-").map(Number);
        if (!y || !m || !d) return null;
        return new Date(Date.UTC(y, m - 1, d));
    };

    // Add N days in UTC to a date-only ISO string, return a new date object
    const addDaysUTC = (iso: string, days: number): Date | null => {
        const dt = parseIsoDateOnly(iso);
        if (!dt) return null;
        dt.setUTCDate(dt.getUTCDate() + days);
        return dt;
    };

    // "06 OCT 25" (two-digit day, 3-letter uppercase month, 2-digit year)
    const fmtDD_MON_YY = (isoOrDate?: string | Date | null): string => {
        const dt =
            typeof isoOrDate === "string" || isoOrDate == null
                ? parseIsoDateOnly(isoOrDate as string | null)
                : (isoOrDate as Date);
        if (!dt) return "TBD";
        const dd = String(dt.getUTCDate()).padStart(2, "0");
        const mon = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
        const yy = String(dt.getUTCFullYear()).slice(-2);
        return `${dd} ${mon} ${yy}`;
    };

    // "MM/DD/YYYY" format
    const fmtMM_DD_YYYY = (isoOrDate?: string | Date | null): string => {
        const dt =
            typeof isoOrDate === "string" || isoOrDate == null
                ? parseIsoDateOnly(isoOrDate as string | null)
                : (isoOrDate as Date);
        if (!dt) return "TBD";
        const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(dt.getUTCDate()).padStart(2, "0");
        const yyyy = dt.getUTCFullYear();
        return `${mm}/${dd}/${yyyy}`;
    };

    // Tracks what we last wrote so we can remove precisely
    const lastPreorderKeysRef = useRef<string[]>([]);

    const removePreviouslyAddedProps = async () => {
        // Remove tracked properties from previous run
        if (lastPreorderKeysRef.current.length) {
            await api.cart.removeCartProperties(lastPreorderKeysRef.current);
            lastPreorderKeysRef.current = [];
        }
    };


    // helpers assumed present: pickPayload, isPreorder, buildDisplayTitle,
    // getEstimatedShipDateISO, parseIsoDateOnly, addDaysUTC, fmtDD_MON_YY

    // zero-width space to keep keys unique but visually identical
    const ZWSP = "\u200B";

    const buildDynamicPreorderProps = async (ok: Array<{ variantId: string; data: any }>) => {
        const props: Record<string, string> = {};
        const seenTitles = new Map<string, number>();
        const preorderMap = new Map<string, string>();
        let preorderStartISO: string | null = null;
        let estIdx = 0;

        for (const r of ok) {
            const p = pickPayload(r.data);
            if (!isPreorder(p)) continue;

            // Title key (dedupe title lines like "Name (2)")
            const base = (buildDisplayTitle(p) || "Preorder Item").replace(/["]/g, "").trim();
            const count = seenTitles.get(base) ?? 0;
            seenTitles.set(base, count + 1);
            const titleKey = count === 0 ? base : `${base} (${count + 1})`;

            // Date range
            const isoStart = getEstimatedShipDateISO(p);
            if (!preorderStartISO && isoStart) preorderStartISO = isoStart;
            const startStr = fmtMM_DD_YYYY(isoStart);
            const endStr = fmtMM_DD_YYYY(isoStart ? addDaysUTC(isoStart, PREORDER_END_DAYS) : null);
            const estDateValue = `${startStr} - ${endStr}`;


            // Title line: product name with variant
            props[base] = " ";


            preorderMap.set(r.variantId, estDateValue);
        }
        if (preorderMap.size === 0) {

            return;
        }

        // Add line item properties for each preorder item
        for (const line of cart?.lineItems || []) {
            // Extract variant ID from line item
            const lineVariantId = String(line?.variantId ?? '').trim();
            if (!lineVariantId) continue;

            // Check if this variant has a preorder EstDate
            const estDate = preorderMap.get(lineVariantId);
            if (!estDate) continue;

            // Add preorder.estimated_ship_date as a line item property

            await api.cart.addLineItemProperties(line.uuid, {
                "preorder.estimated_ship_date": estDate
            });
        }

        // // Add cart-level property if preorderStartISO exists
        // if (preorderStartISO) {
        //     const cartStart = fmtMM_DD_YYYY(preorderStartISO);
        //     const cartEnd = fmtMM_DD_YYYY(addDaysUTC(preorderStartISO, PREORDER_END_DAYS));
        //     const cartValue = `Expected to ship : ${cartStart} - ${cartEnd}`;
        //     await api.cart.addCartProperties({
        //         "preorder_estimated_date": cartValue
        //     });
        // For email/receipt, you can use:
        // `Preorder expected to ship by: ${cartStart} — ${cartEnd}`
        // This can be passed to your email/receipt template as needed.


        if (!Object.keys(props).length) return null;

        // Add date display properties (shared for all preorder items)
        props["Preorder Estimated Date"] = " ";
        props["Estimated to ship"] = preorderStartISO ? `${fmtMM_DD_YYYY(preorderStartISO)} - ${fmtMM_DD_YYYY(addDaysUTC(preorderStartISO, PREORDER_END_DAYS))}` : "TBD";

        // Header must be non-empty to render
        return { "Preorder Items": " ", ...props };
    };


    const fetchPreorderCheckConfig = async () => {
        try {
            if (!token) return;
            const url = `${host}/pos/v1/preorder/preorderCheckConfigs`;

            const response = await fetch(url, {
                method: "GET",
                mode: "cors",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });
            const result = await response.json();
            if (result.success) {
                setPreoderCheckConfig(result.payload); // Update orderData with the payload from the API
            } else {
                console.error('Error fetching data:', result.error);
                setError(result.error);
            }
        } catch (error) {
            console.error('Network error:', error);
            setError('Unauthorized: Invalid session');
        }
    };

    useEffect(() => {
        if (!token) return;
        fetchPreorderCheckConfig(); // Initial fetch
    }, [token]);

    useEffect(() => {
        const run = async () => {
            if (!token) return;
            if (!variantIds.length) return;

            //const hash = makeHash(variantIds);
            // if (hash === lastHashRef.current) {
            //   // even if IDs unchanged, try to attach (covers refresh/resume cases)
            //   await addPropsIfNeeded();
            //   return;
            // }
            // lastHashRef.current = hash;

            try {
                const results = await Promise.allSettled(
                    variantIds.map(async (id) => {
                        const url = `${host}/pos/v1/preorder/variant-details?variantId=${encodeURIComponent(id)}`;
                        const res = await fetch(url, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            credentials: 'include',
                            mode: 'cors',
                        });
                        const json = await res.json().catch(() => ({}));
                        return { variantId: id, data: json };
                    })
                );

                const ok = results
                    .filter((r): r is PromiseFulfilledResult<{ variantId: string; data: any }> => r.status === 'fulfilled')
                    .map((r) => r.value);

                await removePreviouslyAddedProps();

                // Build new dynamic props from responses
                const props = await buildDynamicPreorderProps(ok);
                if (props) {
                    await api.cart.addCartProperties(props);
                    // Remember exactly which keys we added so we can remove them next time
                    lastPreorderKeysRef.current = Object.keys(props);
                    api.toast.show(`${preorderCheckConfig?.ToastMessage}`, { duration: Number(preorderCheckConfig?.messageDuration) });
                } else {
                    // No preorder → nothing to write; ensure flag & header removed
                    await api.cart.removeCartProperties(['Pre-Order Items']);
                }
                //await addPropsIfNeeded();
            } catch {
                api.toast.show('Preorder check failed.', { duration: 2500 });
            }
        };
        if (preorderCheckConfig?.enable) {
            run();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variantIds.join(','), preorderCheckConfig]);

    useEffect(() => {
        const fetchData = async () => {
            let response = await ENjsonData.main;
            if (locale.includes('fr-CA')) {
                response = await FRcajsonData.main;
            }
            setMessages(response)
        };
        fetchData();
    }, []);

    let customerId = cart?.customer?.id;
    const initialLoad = {
        isCartFetched: false,
        customerId: "",
        isLoading: true,
        customerData: null,
        isError: false,
        isEnvLoaded: false,
        envs: null,
        rewardPointsSelected: 0,
    };
    const [state, dispatch] = useReducer(customerReducer, initialLoad);

    useEffect(() => {
        let cartCustId;

        cartCustId = cart?.customer?.id;
        if (cartCustId) {
            dispatch({ type: UPDATE_CUSTOMERID, payload: cartCustId });
            if (cart?.lineItems) {
                let isLoyaltyRewardPresent = cart.lineItems
                    .map((a) => a.properties)

                    .filter((x) => x).flat().reduce((accumulator, item) => {
                        const loyaltyReward = item?._LoyaltyReward;
                        if (loyaltyReward) {
                            const value = loyaltyReward.split("|")[1];
                            accumulator += Number(value);
                        }
                        return accumulator;
                    }, 0);


                if (isLoyaltyRewardPresent) {
                    dispatch({
                        type: UPDATE_POINTSUSED,
                        payload: isLoyaltyRewardPresent,
                    });
                }
                else {
                    dispatch({
                        type: UPDATE_POINTSUSED,
                        payload: 0,
                    });
                }

            }
        } else {
            setAvailableQuantity(0);
            setBirthdayMessage('');
            setGiftsData(null);
            dispatch({ type: NO_CUSTOMERID });
            dispatch({
                type: UPDATE_POINTSUSED,
                payload: 0,
            });
        }
    }, [cart]);


    useEffect(() => {
        if (!cart?.customer?.id && cart?.lineItems?.length === 0) {
            //api.cart.clearCart();
        }
    }, [cart?.lineItems?.length]);

    useEffect(() => {
        if (!cart?.customer?.id) {
            api.cart.removeCartProperties(['Discount'])
        }
    }, [cart?.customer])

    useEffect(() => {
        if ((!cart?.properties || cart?.properties?.Discount !== scanDiscountDataConfig?.discountCode) && cart?.cartDiscounts[0]?.discountDescription === scanDiscountDataConfig?.discountCode) {
            api.cart.removeCartDiscount();
        }
    }, [cart?.cartDiscounts]);


    // useEffect(() => {
    //     if(cart?.cartDiscounts[0]?.discountDescription !== scanDiscountDataConfig?.discountCode){
    //             if(cart?.properties?.Discount){
    //                 api.cart.removeCartProperties(['Discount'])
    //             }
    //     }
    // }, [cart?.cartDiscounts]);


    const fetchCustomeData = async () => {
        if (!token) return;
        const url = `${host}/pos/v1/customer/getdata?customerId=${state.customerId}`;
        const response = await fetch(url, {
            method: "GET",
            mode: "cors",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });
        const result = await response.json();
        //setLog(JSON.stringify(result));
        setCustomerData(result?.payload);
        if (response.ok) {
            dispatch({ type: LOAD_CUSTOMERDATA, payload: result });
        } else {
            dispatch({ type: LOADING_CUSTOMERERROR });
        }
    };

    useEffect(() => {
        // If the cart changes, we want to update the subtitle and tile state
        if (customerData && customerData?.phone === '' && customerData?.phoneValidationConfig?.showMessage?.BOOL) {
            api.toast.show(customerData?.phoneValidationConfig?.message?.S, { duration: Number(customerData?.phoneValidationConfig?.timer?.S) });
        }
    }, [customerData])

    useEffect(() => {
        if (!token) return;
        if (state.customerId) {
            fetchCustomeData();
        }
    }, [state.customerId, token]);
    let existingUser = state?.customerData?.payload;

    let defaultPointBalance = existingUser?.loyaltyInfo?.points_approved || 0;
    const [pointBalance, setPointBalance] = useState('');
    const [tierLevel, setTierLevel] = useState('');

    useEffect(() => {
        let points = defaultPointBalance - state?.rewardPointsSelected;
        setPointBalance(points.toString());
    }, [defaultPointBalance, state?.rewardPointsSelected]);

    useEffect(() => {
        let customerId = cart?.customer?.id;
        if (customerId) {
            fetchGiftsRewards();
        }
    }, [cart?.customer?.id]);


    const fetchGiftsRewards = async () => {
        if (!token) return;
        const url = `${host}/pos/v1/customer/gifts?customerId=${customerId}`;
        const response = await fetch(url, {
            method: "GET",
            mode: "cors",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const result = await response.json();
            setGiftsData(result?.payload?.data?.gifts || []);
        }
    };


    const fetchInventoryQuantity = async (variantId) => {
        if (!token) return;
        const url = `${host}/pos/v1/inventory/quantity?variantId=${variantId}&locationId=${locationId}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result?.payload?.availableQuantity || 0;
    };

    useEffect(() => {
        // Only run if giftsData is present and not empty
        if (giftsData && giftsData.length > 0) {
            // Filter for all birthday gifts
            const birthdayGifts = giftsData.filter(gift => gift.gift_type === "birthday_gift");

            if (birthdayGifts.length > 0) {
                // Fetch and sum inventory for all birthday gift variants
                const fetchAllQuantities = async () => {
                    try {
                        const quantities = await Promise.all(
                            birthdayGifts.map(gift => fetchInventoryQuantity(gift.variant_id))
                        );
                        // Sum all the available quantities
                        const totalQuantity = quantities.reduce((sum, qty) => sum + (qty || 0), 0);
                        setAvailableQuantity(totalQuantity);
                    } catch (error) {
                        api.toast.show("Error fetching birthday gift inventory.", { duration: 3000 });
                        setAvailableQuantity(0);
                    }
                };
                fetchAllQuantities();
            } else {
                setAvailableQuantity(0);
            }
        } else {
            setAvailableQuantity(0);
        }
    }, [giftsData]);

    useEffect(() => {
        // If a birthday is available, parse it
        if (existingUser?.loyaltyInfo?.birthday) {
            // e.g. "1920-07-12T09:00:00-08:00"
            const date = new Date(existingUser.loyaltyInfo.birthday);

            // Month in "Jan", "Feb", "Mar" format
            const monthShort = date.toLocaleString("en", { month: "long" });
            const day = String(date.getDate()).padStart(2, "0"); // "01"-"31"

            // Store MMM + day in state
            setCustomerBday({ month: monthShort, day });

            // Compare numeric month indexes
            const birthdayMonthIndex = date.getMonth(); // 0-11
            const currentMonthIndex = new Date().getMonth(); // 0-11

            if (birthdayMonthIndex === currentMonthIndex && availableQuantity > 0 && customerData?.birthdayToastConfig?.showMessage?.BOOL) {
                // If birthday month is the current month, show in subtitle
                setBirthdayMessage(`B'day: ${monthShort} ${day}`);
            } else {
                setBirthdayMessage("");
            }
        } else {
            // No birthday in loyalty info
            setCustomerBday({ month: "", day: "" });
            setBirthdayMessage("");
        }
    }, [existingUser, availableQuantity, customerData]);

    let defaultIsNewCust = false;
    if (existingUser) {
        defaultIsNewCust = false;
    } else {
        defaultIsNewCust = true;
    }
    let aloLLOptInFlag = false;
    if (defaultIsNewCust) {
        aloLLOptInFlag = true;
    } else {
        if (existingUser?.blockedStatus) {
            aloLLOptInFlag = false;
        } else {
            aloLLOptInFlag = !!existingUser?.loyaltyInfo?.enroll_date;
        }
    }

    let tempTier = "";
    const tierMapping = {
        tier1: LLTIER_1,
        tier2: LLTIER_2,
        tier3: LLTIER_3,
    };
    if (existingUser?.loyaltyInfo?.loyalty_tier) {
        const aloTier = existingUser?.loyaltyInfo?.loyalty_tier;
        if (
            aloTier.toLowerCase() === ALOTIER_1 ||
            aloTier.toLowerCase() === ALOTIER_2 ||
            aloTier.toLowerCase() === ALOTIER_3
        ) {
            tempTier = tierMapping[`${aloTier}`];
        } else {
            tempTier = aloTier;
        }
    }
    if (!tempTier) {
        if (existingUser?.email) {
            tempTier = "VIP";
        } else if (existingUser) {
            tempTier = "N/A";
        }
    }

    if (!aloLLOptInFlag) {
        tempTier = "N/A";
    }

    let defaultTier = tempTier || "";
    if (existingUser?.blockedStatus) {
        defaultTier = "N/A";
    }


    useEffect(() => {
        setTierLevel(defaultTier);
    }, [defaultTier])

    useEffect(() => {
        if (birthdayMessage && availableQuantity > 0 && customerData?.birthdayToastConfig?.showMessage?.BOOL) {
            // The user’s birthday month is this month – show a toast.

            //api.toast.show(customerData,{duration: 600000});
            api.toast.show(
                "It's your guest's birthday month! Select the Alo Access tile to add their gift to the cart and wish them a happy birthday!",
                { duration: 600000 });
        }
    }, [birthdayMessage, customerData]);

    const fetchScanDataConfig = async () => {
        if (!token) return;
        try {
            const url = `${host}/pos/v1/scanner/scannerDiscount`;

            const response = await fetch(url, {
                method: "GET",
                mode: "cors",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });
            const result = await response.json();
            if (result.success) {
                setScanDiscountDataConfig(result.payload); // Update orderData with the payload from the API
            } else {
                console.error('Error fetching data:', result.error);
                setError(result.error);
            }
        } catch (error) {
            console.error('Network error:', error);
            setError('Unauthorized: Invalid session');
        }
    };

    useEffect(() => {
        if (!token) return;
        fetchScanDataConfig(); // Initial fetch
    }, [token]);

    useEffect(() => {
        // api.toast.show(`Scanned data: ${cartDet.properties?.Discount || ''}`, { duration: 3000 });
        if (cart?.lineItems?.length > 0 && cart.properties?.Discount) {
            api.cart.addCartCodeDiscount(cart.properties?.Discount).then(() => {
                api.toast.show(`${scanDiscountDataConfig?.discountMessage}`, { duration: Number(scanDiscountDataConfig?.messageDuration) });
            })
        }
    }, [cart?.lineItems?.length, cart?.customer?.id]);

    return (
        <Tile
            title={!customerId ? `${messages.AddCustomer}` : `${messages.EditCustomer}`}
            subtitle={
                customerId
                    ? (showAloAccessOptIn ? `${tierLevel} | ${messages.PointBalance}: ${pointBalance}` : '') +
                    (birthdayMessage ? `\n${birthdayMessage}` : '')
                    : ''
            }
            onPress={async () => {
                try {
                    await api.action.presentModal();
                } finally {
                    await refreshFlags();
                }
            }}
            enabled
            destructive={true}
        />
    );

}

function TileWrapper() {
  const api = useApi();
  const { currentSession } = api.session;
  const { shopDomain } = currentSession;

  return (
    <CartProvider>
      <ConfigProvider api={api} shopDomain={shopDomain}>
        <SmartGridTile />
      </ConfigProvider>
    </CartProvider>
  );
}

export default reactExtension('pos.home.tile.render', () => <TileWrapper />)