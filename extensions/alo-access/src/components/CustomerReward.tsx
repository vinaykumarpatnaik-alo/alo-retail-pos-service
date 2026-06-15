import React, { useState, useEffect, useReducer } from 'react';
import { useApi, useCartSubscription, useLocaleSubscription, Screen, Button, Dialog, ScrollView, Section, Stack, Text,List } from '@shopify/ui-extensions-react/point-of-sale';
import { AloHeader } from './customerTier';
import { Gifts } from './AloGifts/Gifts';
import { LLRewards } from './AloRewards/LLRewards';
import { SelectionContext } from "./context/SelectionContext";
import { Discounts } from './AloDiscounts/Discounts';
import ENjsonData from '../../locales/en.json';
import FRcajsonData from '../../locales/fr-ca.json';
import { useCart, CartProvider } from '../../../pos-cart-utils/context/CartProvider';

const RewardsReducer = (state, action) => {
    const { type, payload } = action;
    switch (type) {
        case "WELCOME DISCOUNT SELECT":
            return {
                ...state,
                wdSelect: payload,
            };
        case "WELCOME GIFT SELECT":
            return {
                ...state,
                wgSelect: payload,
            };
        case "EXCLUSIVE GIFT SELECT":
            return {
                ...state,
                egSelect: payload,
            };
        case "BIRTHDAY GIFT SELECT":
            return {
                ...state,
                bgSelect: payload,
            };
        case "LOYALTY REWARD SELECT":
            return {
                ...state,
                llRewardsSelect: payload,
            };
        default:
            return { ...state };
    }
};

const customerReducer = (state, action) => {
    const { type, payload } = action;
    
    switch (type) {
        case "LOADHEADER":
            const tierStates = state?.tierState;
            tierStates.tierType.tierField = payload?.Tier;
            tierStates.name.tierField = payload?.Name;
            tierStates.pointsBalance.tierField = payload?.PointBalance;

        case "LOADCUSTOMERDATA":
            //update TierState
            const tempTierState = state?.tierState;
            const tierMapping = {
                tier1: "VIP",
                tier2: "A-LIST",
                tier3: "ALL ACCESS",
            };
            if (payload?.customerData?.loyaltyInfo?.loyalty_tier) {
                const aloTier =
                    payload?.customerData?.loyaltyInfo?.loyalty_tier?.toLowerCase();
                if (
                    aloTier?.toLowerCase() === "tier1"?.toLowerCase() ||
                    aloTier?.toLowerCase() === "tier2"?.toLowerCase() ||
                    aloTier?.toLowerCase() === "tier3"?.toLowerCase()
                ) {
                    tempTierState.tierType.tierFieldValue =
                        tierMapping[`${aloTier}`]?.toLowerCase();
                } else {
                    tempTierState.tierType.tierFieldValue = "N/A";
                }
            }

            const name = `${payload?.customerData?.firstName} ${payload?.customerData?.lastName}`;
            if (name) {
                tempTierState.name.tierFieldValue = name;
            }
            let cartLoyaltyPoints = 0;
            if (payload?.cartRewards?.length > 0) {
                let cartRewardVariants = payload?.cartRewards;
                if (cartRewardVariants?.length > 0) {
                    for (let ri = 0; ri < cartRewardVariants?.length; ri++) {
                        const cartR = cartRewardVariants[ri];
                        cartLoyaltyPoints += +cartR?.points || 0;
                    }
                }
            }
            if (payload?.customerData?.loyaltyInfo?.points_approved) {
                tempTierState.pointsBalance.tierFieldValue =
                    payload?.customerData?.loyaltyInfo?.points_approved -
                    cartLoyaltyPoints;
            }

            const custBlockStatus = payload?.customerData?.blockedStatus;
            const custEnrolled = payload?.customerData?.loyaltyInfo?.enroll_date;
            if (custBlockStatus || !custEnrolled) {
                tempTierState.tierType.tierFieldValue = "N/A";
                tempTierState.pointsBalance.tierFieldValue = 0;
            }
            //update cartflags
            const tempCartflags = state.cartflags;
            tempCartflags.isDiscountPresent =
                payload?.cartflags?.discountPresent || false;
            tempCartflags.isWelcomeGiftPresent =
                payload?.cartflags?.welcomeGiftPresent || false;
            tempCartflags.isExclusiveGiftPresent =
                payload?.cartflags?.exclusiveGiftPresent || false;
            tempCartflags.isBirthdayGiftPresent =
                payload?.cartflags?.birthdayGiftPresent || false;

            return {
                ...state,
                customerData: payload?.customerData,
                isLoading: false,
                isError: false,
                cartflags: tempCartflags,
                tierState: tempTierState,
                cartRewards: payload?.cartRewards || [],
            };
        case "LOAD_CUSTOMERPOINTS":
            //update TierState
            const pointsTier = state?.tierState;
            pointsTier.pointsBalance.tierFieldValue = payload;
            return {
                ...state,
                tierState: pointsTier,
            };
            break;
        case "LOADINGCUSTOMERERROR":
            return { ...state, isError: true, isLoading: false };
        default:
            return { ...state };
    }
};

export const CustomerReward = ({ cartData }) => {
    const api = useApi();
    const cart = useCart();
    const { currentSession, getSessionToken } = useApi().session;
    const { shopDomain } = currentSession;
    let host = "";
    if (shopDomain.includes('dev') || shopDomain.includes('test') || shopDomain.includes('it-aloyoga')) {
        host = "https://alo.pos.shopifyapps.dev.alo.software";
    } else {
        host = "https://alo.pos.shopifyapps.alo.software";
    }
    const [loading, setLoading] = useState(true);
    const [cartPayload, setCartPayload] = useState([]);
    const [closeCart, setCloseCart] = useState(false);
    const [loader, setLoader] = useState(false);
    const [dataGiftPresent, setGiftPresent] = useState(true);
    const [dataDiscountPresent, setDiscountPresent] = useState(false);
    const [dataLoyaltyPresent, setLoyaltyPresent] = useState(false);
    const { name, getDeviceId } = useApi().device;
    const [messages, setMessages] = useState<any>('');
    const locale = useLocaleSubscription();

    useEffect(() => {
        const fetchData = async () => {
            let response = await ENjsonData.main;
            if (locale.includes('fr-CA')) {
                response = await FRcajsonData.main;
            }
            setMessages(response)
            dispatch({ type: "LOADHEADER", payload: response });
        };
        fetchData();
    }, []);

    let customerId = cart?.customer?.id;

    const initialLoad = {
        customerData: null,
        isError: false,
        cartRewards: [],
        cartflags: {
            isDiscountPresent: false,
            isWelcomeGiftPresent: false,
            isExclusiveGiftPresent: false,
            isBirthdayGiftPresent: false,
        },
        tierState: {
            tierType: {
                tierField: "",
                tierFieldValue: "N/A",
            },
            name: {
                tierField: "",
                tierFieldValue: "",
            },
            pointsBalance: {
                tierField: "",
                tierFieldValue: 0,
            },
        },
    };

    const [customerInfo, dispatch] = useReducer(customerReducer, initialLoad);


    const getCartRewards = () => {
        const lineItems = cart?.lineItems;
        let cartLoyaltyPoints = 0;
        let cartRewardVariants = [];
        if (lineItems && Array.isArray(lineItems) && lineItems?.length > 0) {
            let cartReward = {
                variantId: '0',
                points: 0,
                rewardId: 0,
                isAddToCart: true,
                isUserAdded: false,
                lineItemNumber: Infinity,
            };
            for (let i = 0; i < lineItems.length; i++) {
                let lineItem = lineItems[i];
                if (
                    lineItem?.discounts[0]?.discountDescription?.toLowerCase() ===
                    "Loyalty Reward".toLowerCase()
                ) {
                    let lineItemproperties = lineItem?.properties;
                    let properties = [{ name: '', value: '' }]
                    if (lineItemproperties) {
                        //api.toast.show(JSON.stringify(properties),{duration:3000});
                        // let newObj={name:'',value:''}
                        for (var key in lineItemproperties) {
                            if (lineItemproperties.hasOwnProperty(key)) {
                                properties[0].name = key;
                                properties[0].value = lineItemproperties[key]
                            }
                        }
                        let rewardIdPresent = false;
                        let cartItemPoints = 0;
                        let rewardValue = "";
                        for (let j = 0; j < properties?.length; j++) {
                            let propItem = properties[j];
                            if (propItem["name"] == "_LoyaltyReward") {
                                rewardIdPresent = true;
                                rewardValue = propItem["value"];
                            }
                        }
                        if (rewardIdPresent) {
                            cartLoyaltyPoints += cartItemPoints;
                            cartReward.variantId = lineItem?.variantId?.toString() || '0';
                            cartReward.lineItemNumber = i;
                            const rewardProps = rewardValue.split("|");
                            const [rewardId, rewardPoints] = rewardProps;
                            cartReward.rewardId = Number(rewardId);
                            cartReward.points = Number(rewardPoints);
                            cartRewardVariants.push({ ...cartReward });
                        }
                    }
                }
            }
        }
        return cartRewardVariants;
    };
    const initialSelect = {
        wdSelect: {
            giftChecked: false,
            variantId: 0,
            giftType: "",
            price: 0,
        },
        wgSelect: {
            giftChecked: false,
            variantId: 0,
            giftType: "",
            price: 0,
        },
        egSelect: {
            giftChecked: false,
            variantId: 0,
            giftType: "",
            price: 0,
        },
        bgSelect: {
            giftChecked: false,
            variantId: 0,
            giftType: "",
            price: 0,
        },
        llRewardsSelect: {
            giftChecked: false,
            variantsArr: getCartRewards(),
            giftType: "",
        },
    };

    const [variantSelected, rewardDispatch] = useReducer(
        RewardsReducer,
        initialSelect
    );
    // api.toast.show(JSON.stringify(variantSelected.llRewardsSelect),{duration:3000})
    const updateWithCartFlags = (loyaltyRewards) => {
        const llArr = loyaltyRewards?.variantsArr;
        const updateArray = [];
        if (llArr?.length > 0) {
            for (let si = 0; si < llArr?.length; si++) {
                const selReward = { ...llArr[si] };
                const rewardsCartArr = customerInfo?.cartRewards;
                selReward.isAddToCart = false;
                if (rewardsCartArr?.length > 0) {
                    for (let ci = 0; ci < rewardsCartArr?.length; ci++) {
                        const cartR = rewardsCartArr[ci];
                        if (
                            cartR?.variantId?.toString() === selReward?.variantId?.toString()
                        ) {
                            selReward.isAddToCart = true;
                            break;
                        }
                    }
                } 
                updateArray.push({ ...selReward });
            }
        }
        
        return updateArray;
    };
    const checkContext = (payload) => {
        // api.toast.show('poa',{duration:3000})
        switch (payload.giftType) {
            case "Welcome 10% off":
                rewardDispatch({ type: "WELCOME DISCOUNT SELECT", payload: payload });
                break;
            case "Welcome Gift":
                rewardDispatch({ type: "WELCOME GIFT SELECT", payload: payload });
                break;
            case "Exclusive Gift":
                rewardDispatch({ type: "EXCLUSIVE GIFT SELECT", payload: payload });
                break;
            case "Birthday Gift":  
                rewardDispatch({ type: "BIRTHDAY GIFT SELECT", payload: payload });
                break;
            case "Loyalty Reward":
                
                const withCartFlags = updateWithCartFlags(payload);
                let llrewardNew = payload;
                llrewardNew.variantsArr = withCartFlags;
                //api.toast.show('haai',{duration:3000})
                rewardDispatch({ type: "LOYALTY REWARD SELECT", payload: llrewardNew });
                break;
            default:
                
                break;
        }
    };
    useEffect(() => {
        const latestPoints = getUpdatePoints();
        dispatch({ type: 'LOAD_CUSTOMERPOINTS', payload: latestPoints });
    }, [variantSelected?.llRewardsSelect?.variantsArr]);
    const welcomeGift = {
        type: "gift",
        value: 0,
        desc: "Welcome Gift",
        price: variantSelected?.wgSelect?.price,
    };
    
    const exclusiveGift = {
        type: "gift",
        value: 0,
        desc: "Exclusive Gift",
        price: variantSelected?.egSelect?.price,
    };
    

    const discountGift = {
        type: "discount",
        value: 0,
    };
    
    const bdayGift = {
        type: "gift",
        value: 0,
        desc: "Birthday Gift",
        price: variantSelected?.bgSelect?.price,
    };


    useEffect(() => {
        let customerId = cart?.customer?.id;   
        if (customerId) {
            fetchCustomeData();
        }
        else {
            setLoading(false);
        }
    }, [cart?.customer?.id]);

    const getVariants = (giftsData) => {
        const dICard = {
            type: "discount",
            desc: "Welcome 10% off",
            variants: [],
        };

        const wGCard = {
            type: "gift",  
            desc: "Welcome Gift",
            variants: [],
        };

        const eGCard = {
            type: "gift",
            desc: "Exclusive Gift",
            variants: [],
        };

        const bGCard = {
            type: "gift",
            desc: "Birthday Gift",
            variants: [],
        };

        const diVariants = [];
        const wGVariants = [];
        const eGVariants = [];
        const bGVariants = [];
        if (giftsData?.length > 0) {
            for (let i = 0; i < giftsData?.length; i++) {
                const gift = giftsData[i];
                if (gift?.gift_type === "welcome_gift_10PCT") {
                    diVariants.push(gift?.discountCode);
                    continue;
                }
                if (gift?.gift_type === "welcome_gift") {
                    wGVariants.push(gift?.variant_id || 0);
                    continue;
                }
                if (gift?.gift_type === "regular_gift") {
                    eGVariants.push(gift?.variant_id || 0);
                    continue;
                }
                if (gift?.gift_type === "birthday_gift") {
                    bGVariants.push(gift?.variant_id || 0);
                    continue;
                }
            }
        }

        wGCard.variants = wGVariants;
        eGCard.variants = eGVariants;
        dICard.variants = diVariants;
        bGCard.variants = bGVariants;
        return [dICard, wGCard, eGCard, bGCard];
    };


    const lookIntoCart = (cData) => {
        const giftsData = cData?.gifts || [];
        const giftCards = getVariants(giftsData);
        const [discountGift, welcomeGift, exclusiveGift, birthdayGift] = giftCards;
        const lineItems = cart?.lineItems;
        const llRewardsData = cData?.llRewards;
        let welcomeGiftPresent = false;
        let exclusiveGiftPresent = false;
        let discountPresent = false;
        let birthdayGiftPresent = false;
        if (lineItems && Array.isArray(lineItems) && lineItems?.length > 0) {
            for (let i = 0; i < lineItems?.length; i++) {
                const cartItem = lineItems[i];
                if (
                    cartItem?.discounts[0]?.amount > 0 &&
                    cartItem?.discounts[0]?.type?.toLowerCase() == "fixedamount"
                ) {
                    if (
                        cartItem?.discounts[0]?.discountDescription?.toLowerCase() ==
                        welcomeGift?.desc?.toLowerCase() &&
                        welcomeGift?.variants?.includes(cartItem?.variantId?.toString())
                    ) {
                        
                        welcomeGiftPresent = true;
                        continue;
                    }
                    if (
                        cartItem?.discounts[0]?.discountDescription?.toLowerCase() ==
                        exclusiveGift?.desc?.toLowerCase() &&
                        exclusiveGift?.variants?.includes(cartItem?.variantId?.toString())
                    ) {
                        exclusiveGiftPresent = true;
                        continue;
                    }
                    if (
                        cartItem?.discounts[0]?.discountDescription?.toLowerCase() ==
                        birthdayGift?.desc?.toLowerCase() &&
                        birthdayGift?.variants?.includes(cartItem?.variantId?.toString())
                    ) {
                        
                        birthdayGiftPresent = true;
                        continue;
                    }
                }
                if (welcomeGiftPresent && exclusiveGiftPresent && birthdayGiftPresent) {
                    break;
                }
            }
        } 

        
        let discountCode = '';
        for (let i = 0; i < giftsData?.length; i++) {
            let discountItem = giftsData[i];
            if (
                discountItem?.gift_type?.toLowerCase() ===
                "discount".toLowerCase()
            ) {
                discountCode = discountItem?.discountCode || 0;
               
                break;
            }
        }

        
        const discounts = cart?.cartDiscount;
        if (
            discounts &&
            discounts[0]?.discountDescription?.toLowerCase() ===
            discountCode?.toLowerCase()
        ) {
            discountPresent = true;
        }
        
        return {
            discountPresent,
            welcomeGiftPresent,
            exclusiveGiftPresent,
            birthdayGiftPresent,
        };
    };

    const checkDiscountPresent = (cartFlags) => {
        if (cartFlags) {
            let discountData = cartFlags.some(obj => obj.id === "Discount" && obj.value === true);
            let giftsData = cartFlags.every(gift => gift.id !== "Welcome Gift" || !gift.value) &&
                cartFlags.every(gift => gift.id !== "Exclusive Gift" || !gift.value) &&
                cartFlags.every(gift => gift.id !== "Birthday Gift" || !gift.value);
            let loyaltyData = cartFlags.some(obj => obj.id === "Loyalty Reward" && obj.value === true);
            if (discountData) {
                setDiscountPresent(true);
            }
            if (giftsData) {
                setGiftPresent(false);
            }
            if (loyaltyData) {
                setLoyaltyPresent(true);
            }
        }
    }
    const fetchCustomeData = async () => {   
        const token = await api.session.getSessionToken();
        const url = `${host}/pos/v1/extensions/rewards?customerId=${customerId}&shop=${shopDomain}`;
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
        
        if (response.ok) {
            
            const customerQueryResponse = result?.payload;
            const cartflags = lookIntoCart(customerQueryResponse);;
            
            const cartRewards = getCartRewards();
            const updatedCustomerInfo = {
                customerData: result?.payload,
                cartflags: cartflags,
                cartRewards: cartRewards,
            };
            //api.toast.show(JSON.stringify(cartflags),{duration:3000})
            checkDiscountPresent(result?.payload?.enableFlags);
            //api.toast.show(JSON.stringify(dataDiscountPresent),{duration:3000})
            dispatch({ type: "LOADCUSTOMERDATA", payload: updatedCustomerInfo });
            setLoading(false);
        } else {
            setLoading(false);
            
            dispatch({ type: "LOADINGCUSTOMERERROR" });
            api.toast.show('Try again later', { duration: 3000 })
        }
    };
   
   
    const checkCartRewardRemoval = () => {
        let cartInRewards = customerInfo?.cartRewards;
        const selectedRewards = variantSelected?.llRewardsSelect?.variantsArr;
        
        let cartItemRemoved = false;
        if (cartInRewards?.length > 0) {
            for (let cr = 0; cr < cartInRewards?.length; cr++) {
                //api.toast.show(JSON.stringify(customerInfo),{duration:3000})
                const cReward = cartInRewards[cr];
                
                if (selectedRewards?.length > 0) {
                    
                    let varMatchfound = false;
                    for (let sr = 0; sr < selectedRewards?.length; sr++) {
                        const selreward = selectedRewards[sr];
                        

                        if (
                            selreward?.variantId?.toString() ===
                            cReward?.variantId?.toString()
                        ) {
                            varMatchfound = true;
                            break;
                        }
                    }
                    if (!varMatchfound) {
                        cartItemRemoved = true;
                    }
                } else {
                    cartItemRemoved = true;
                    break;
                }
                if (cartItemRemoved) {
                    break;
                }
            }
        }
        return cartItemRemoved;
    };
    const checkCartRewardAdd = () => {
        let rewardSaveEnable = false;
        const rewardsSelected = variantSelected?.llRewardsSelect?.variantsArr;
        
        if (rewardsSelected?.length > 0) {
            for (let re = 0; re < rewardsSelected?.length; re++) {
                const rewardSel = rewardsSelected[re];
                if (!rewardSel?.isAddToCart && rewardSel?.isUserAdded) {
                    rewardSaveEnable = true;
                    break;
                }
            }
        }
        return rewardSaveEnable;
    };
    const isRewardAdded = checkCartRewardAdd();
    const isRewardRemoved = checkCartRewardRemoval();
    const tempCartFlags = customerInfo?.cartflags;

    const enableSave =
        isRewardAdded ||
        isRewardRemoved ||
        (variantSelected?.wdSelect?.giftChecked &&
            !tempCartFlags?.isDiscountPresent) ||
        (variantSelected?.wgSelect?.giftChecked &&
            !tempCartFlags?.isWelcomeGiftPresent) ||
        (variantSelected?.egSelect?.giftChecked &&
            !tempCartFlags?.isExclusiveGiftPresent) ||
        (variantSelected?.bgSelect?.giftChecked &&
            !tempCartFlags?.isBirthdayGiftPresent);

    const getUpdatePoints = () => {
        let approvedPoints =
            customerInfo?.customerData?.loyaltyInfo?.points_approved || 0;
        
        const varSelected = variantSelected?.llRewardsSelect?.variantsArr || [];
        let selectRewardsPoints = 0;
        if (varSelected?.length > 0) {
            for (let i = 0; i < varSelected?.length; i++) {
                let selReward = varSelected[i];
                selectRewardsPoints += +selReward?.points || 0;
            }
        }
        let latestPoints = approvedPoints - selectRewardsPoints;

        return latestPoints;
    };

    return (
        <CartProvider>
        <Screen name="Alo Access" title={`${messages.AloAccess}`} isLoading={loading}>
            <AloHeader tierState={customerInfo?.tierState} />
            <ScrollView>
                <>
                    {/* <Text children={JSON.stringify(cartPayload)}/> */}

                    <SelectionContext.Provider
                        value={{
                            variantSelected: variantSelected,
                            rDispatch: checkContext,
                            customerInfo: customerInfo?.customerData,
                            cartData: cart,
                            tierState: customerInfo?.tierState,
                        }}
                    >
                        
                        {dataDiscountPresent && 
                        <>
                        <Stack direction="inline" justifyContent="space-around" flexChildren>
                            <Button title={messages.Discounts} type={"basic"} onPress={() => { }} />
                        </Stack>
                       
                                <Discounts
                                    customerInfo={customerInfo?.customerData}
                                    cartData={cartData}
                                />
                               
                         </>}

                        {dataGiftPresent && <>
                        <Stack direction="inline" justifyContent="space-around" flexChildren>
                            <Button title={messages.Gifts} type={"basic"} onPress={() => { }} />
                        </Stack>
                            
                                <Gifts />
                            </>}
                        {dataLoyaltyPresent && <>
                        <Stack direction="inline" justifyContent="space-around" flexChildren>
                            <Button title={messages.Rewards} type={"basic"} onPress={() => { }} />
                        </Stack>
                      
                                <LLRewards />
                            
                            </>}
                    </SelectionContext.Provider>


                    <Dialog
                        title={messages.Error}
                        content={messages.CustomerOptInError}
                        type="destructive"
                        isVisible={customerInfo?.customerData?.loyaltyInfo?.enroll_date ? false : true}
                        actionText="Close"
                        secondaryActionText=""
                        showSecondaryAction={true}
                        onAction={() => { api.navigation.dismiss() }}
                        onSecondaryAction={() => { }}
                    />
                    <Dialog
                        title={messages.Error}
                        content={messages.EmailError}
                        type="destructive"
                        isVisible={customerInfo?.customerData?.email ? false : true}
                        actionText="Close"
                        secondaryActionText=""
                        showSecondaryAction={true}
                        onAction={() => { api.navigation.dismiss() }}
                        onSecondaryAction={() => { }}
                    />
                    <Dialog
                        title={messages.Error}
                        content={messages.OptOutAloAccessError}
                        type="destructive"
                        isVisible={customerInfo?.customerData?.blockedStatus ? true : false}
                        actionText="Close"
                        secondaryActionText=""
                        showSecondaryAction={true}
                        onAction={() => { api.navigation.dismiss() }}
                        onSecondaryAction={() => { }}
                    />
                </>
            </ScrollView>
            <Stack direction="inline" gap="200" justifyContent="center" flexChildren paddingBlock="200" paddingInlineStart='1200' paddingInlineEnd="1200">
                <Button title={'Done'} type={"primary"} onPress={() => { api.navigation.dismiss() }} isDisabled={!enableSave} isLoading={loader} />
            </Stack>
        </Screen>
        </CartProvider>
    )
}
