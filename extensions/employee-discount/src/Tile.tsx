import React, { useState, useEffect, useRef } from "react";
import {
    useApi,
    Button,
    FormattedTextField,
    Navigator,
    Screen,
    Tile,
    Section,
    Banner,
    Text,
    Stack,
    Icon,
    Selectable,
    useCartSubscription,
    ScrollView,
    useLocaleSubscription,
    reactExtension
} from "@shopify/ui-extensions-react/point-of-sale";
import ENjsonData from '../locales/en.json';
import FRcajsonData from '../locales/fr-ca.json';
import { formatIrelandNumber, formatUKNumber, formatUSNumber } from "./phonenumberFormatter";
import { useCart,CartProvider } from "../../pos-cart-utils/context/CartProvider";
import { useExtensionSession } from "../../shared/useExtensionSession";


const App = () => {
    const api = useApi<'pos.home.tile.render'>();
    const cart = useCart();
    const cartRef = useRef(cart);
    const locale = useLocaleSubscription();
    const { host, token, shopDomain, locationId } = useExtensionSession(api);
    const [messages, setMessages] = useState<any>('');
    const [prevCurrentSpend, setPrevCurrentSpend] = useState(0);
    const [currentSpend, setCurrentSpend] = useState(0);
    const [discountPercentage, setDiscountPercentage] = useState(0);
    const [authenticated, setAuthenticated] = useState<number>();
    const [annualLimit, setAnnualLimit] = useState(0);
    const [isRetailEmployee, setIsRetailEmployee] = useState(false);
    
    const [subtitle, setSubtitle] = useState('');
    const [edpEnable, setEDPenable] = useState(true);
    const [aloDiscounts, setAloDiscounts] = useState([]);//Non Pos Discounts
    const [retailEmployeeDiscount, setRetailEmployeeDiscount] = useState(null);
  
    const staffId = api.session.currentSession.staffMemberId;

    const normalizeDiscountDescription = (value) => String(value || '').trim().toLowerCase();

    useEffect(() => {
        cartRef.current = cart;
    }, [cart]);

    const getCartDiscounts = (cartData = cart) => [
        ...(cartData?.cartDiscount ? [cartData.cartDiscount] : []),
        ...(cartData?.cartDiscounts || []),
    ];

    const getActiveCartDiscount = () => cart?.cartDiscount || cart?.cartDiscounts?.[0] || null;

    const hasCartDiscount = () => getCartDiscounts().length > 0;

    const discountMatchesCode = (discount, discountCode) => {
        const normalizedCode = normalizeDiscountDescription(discountCode);
        if (!discount || !normalizedCode) return false;

        return normalizeDiscountDescription(discount.discountDescription) === normalizedCode;
    }

    const DISCOUNT_CLEANUP_DELAY_MS = 300;
    const DISCOUNT_CLEANUP_RETRY_MS = 500;

    const hasInvalidManualEmployeeDiscount = (cartData = cart) =>
        getCartDiscounts(cartData).some((discount) =>
            discountMatchesCode(discount, retailEmployeeDiscount?.discountcode)
        ) && !cartData?.properties?.Employee_Email_ID;

    const hasValidEmployeeDiscount = (cartData = cart) =>
        getCartDiscounts(cartData).some((discount) =>
            discountMatchesCode(discount, retailEmployeeDiscount?.discountcode)
        ) && !!cartData?.properties?.Employee_Email_ID;

    const hasRestrictedDiscount = (cartData = cart) =>
        getCartDiscounts(cartData).some((discount) =>
            !discountMatchesCode(discount, retailEmployeeDiscount?.discountcode) &&
            aloDiscounts.some((discountCode) => discountMatchesCode(discount, discountCode))
        );

    const removeCartDiscountWithRetry = async (reason: string, shouldStillRemove = () => true) => {
        try {
            await api.cart.removeCartDiscount();
        } catch (error) {
            console.error(`Error removing employee discount (${reason})`, error);
        }

        setTimeout(async () => {
            if (!shouldStillRemove()) return;

            try {
                await api.cart.removeCartDiscount();
            } catch (error) {
                console.error(`Error removing employee discount retry (${reason})`, error);
            }

        }, DISCOUNT_CLEANUP_RETRY_MS);
    };
   
    //const [data, setData] = useState(null);

    const fetchDiscountData = async () => {
        try {
            if (!token) return;
            const url = `${host}/pos/v1/getAloDiscounts/data`;
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
                setAloDiscounts(result.payload.discounts);
                setRetailEmployeeDiscount(result.payload.retailEmployeeDiscount);
            } else {
                console.error('Error fetching data:', result.error);
            }
        }
        catch (error) {
            console.error('Network error:', error);
        }
    }

    const fetchDataStaff = async () => {
        try {
            if (!token) return;

            const url = `${host}/pos/v1/extensions/data?staffId=${staffId}&customerId=${cart?.customer?.id}`;

            const response = await fetch(url, {
                method: "GET",
                mode: "cors",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (response.status !== 200) {
                console.error("Error fetching staff data:", response.status);
                return;
            }

            const data = await response.json();

            if (
                data?.payload?.error === undefined ||
                data?.payload?.error === null ||
                data?.payload?.error?.trim().length === 0
            ) {
                const permission = data?.payload?.user?.permission_enabled;
                const valid =
                    Number(cart?.subtotal) > 1 &&
                    cart?.customer?.id !== null &&
                    cart?.customer?.id !== undefined;

                if (!permission && valid) {
                    setAuthenticated(5);
                }
            } else {
                console.error("API returned error:", data?.payload?.error);
            }
        } catch (error) {
            console.error("Network error:", error);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            let response = await ENjsonData.main;
            if (locale.includes('fr-CA')) {
                response = await FRcajsonData.main;
            }
            setMessages(response)
        };
        fetchData();
        fetchDiscountData();
    }, [cart?.cartDiscount,token]);


    useEffect(() => {
        if (cart.customer?.id && staffId) {
            fetchDataStaff();
        }
    }, [cart, staffId,token]);

    useEffect(() => {
        if (!hasCartDiscount()) {
            if (cart?.properties?.Employee_Email_ID) {
                api.cart.removeCartProperties(['Employee_Email_ID'])
            }
        }
    }, [cart?.cartDiscount, cart?.cartDiscounts, cart?.properties?.Employee_Email_ID])

    useEffect(() => {
        const activeCartDiscount = getActiveCartDiscount();
        if (activeCartDiscount) {
            setEDPenable(false)
            if (discountPercentage > 0) {
                const currentSpentValue = Number(activeCartDiscount?.amount) / (discountPercentage / 100) - Number(activeCartDiscount?.amount);
                setCurrentSpend(Number(currentSpentValue) + Number(prevCurrentSpend));
            }
        } else {
            setEDPenable(true)
            setCurrentSpend(prevCurrentSpend);
        }
    }, [cart?.cartDiscount, cart?.cartDiscounts, discountPercentage, prevCurrentSpend]);

    //when there is no item in cart remove cart properties if it is available
    useEffect(() => {
        if (cart?.lineItems.length === 0 && cart?.properties?.Employee_Email_ID) {
            api.cart.removeCartProperties(['Employee_Email_ID'])
        } else if (cart?.lineItems.length > 0 && cart?.properties?.Employee_Email_ID && !hasCartDiscount()) {
            api.cart.removeCartProperties(['Employee_Email_ID'])
        }
    }, [cart?.lineItems.length, cart?.properties?.Employee_Email_ID, cart?.cartDiscount, cart?.cartDiscounts])

    useEffect(() => {
        if (cart) {
            if (cart.properties?.Employee_Email_ID) {
                getEmployeeDetailsByEmail(cart.properties?.Employee_Email_ID);
            } else {
                setPrevCurrentSpend(0);
                setCurrentSpend(0);
                setAnnualLimit(0);
            }
        }
    }, [cart])

    useEffect(() => {
        if (!cart?.customer?.id && parseInt(cart?.grandTotal) !== 0) {
            setSubtitle(`${messages.AddCustomers}`);
            setEDPenable(false);
        } else if (cart?.customer?.id && parseInt(cart?.grandTotal) === 0) {
            setSubtitle(`${messages.AddItem}`);
            setEDPenable(false);
        } else if (!cart?.customer?.id && parseInt(cart?.grandTotal) === 0) {
            setSubtitle(`${messages.AddCustomerItem}`);
            setEDPenable(false);
        } else if (authenticated === 5 && cart?.customer?.id && parseInt(cart?.grandTotal) !== 0) {
            setSubtitle(`${messages.LeadRequired}`);
            setEDPenable(false);
        } else if (cart?.customer?.id && parseInt(cart?.grandTotal) !== 0 && !hasCartDiscount()) {
            setSubtitle('');
            setEDPenable(true);
        }
    }, [cart, authenticated])

    useEffect(() => {
        if (getActiveCartDiscount() && isRetailEmployee) {
            const calculatedSubtitle =
                ((currentSpend > 0 ? `${messages.CurrentSpend} : ${currentSpend}\n` : '') +
                    (Number(annualLimit) > 0 ? `${messages.AnnualLimit} : ${annualLimit}` : ''));
            setSubtitle(calculatedSubtitle);
            setEDPenable(false);
        }
    }, [cart?.cartDiscount, cart?.cartDiscounts, currentSpend, isRetailEmployee, authenticated])

    useEffect(() => {
        if (prevCurrentSpend >= 0) {
            setCurrentSpend(Number(currentSpend) + Number(prevCurrentSpend));
        }
    }, [prevCurrentSpend])

    //If user try to add discount from 'Apply discount Tile' remove the discount
    //Also this removediscount logic will be triggered when discount is added in background to calculate CurrentSpend
    useEffect(() => {
        const delayTimeout = setTimeout(() => {
            const cartDiscounts = getCartDiscounts();
            if (cartDiscounts.length > 0) {
                if (hasInvalidManualEmployeeDiscount()) {
                    removeCartDiscountWithRetry(
                        "manual employee discount",
                        () => hasInvalidManualEmployeeDiscount(cartRef.current)
                    );
                }
                const restrictedDiscount = !hasValidEmployeeDiscount() && cartDiscounts.find((discount) =>
                    !discountMatchesCode(discount, retailEmployeeDiscount?.discountcode) &&
                    aloDiscounts.some((discountCode) => discountMatchesCode(discount, discountCode))
                );
                const discountValue = restrictedDiscount?.discountDescription || '';
                if (restrictedDiscount) {
                    removeCartDiscountWithRetry(
                        "restricted discount",
                        () => hasRestrictedDiscount(cartRef.current) && !hasValidEmployeeDiscount(cartRef.current)
                    );
                    api.toast.show(`${discountValue} is no longer valid in stores. Please do not apply a manual discount.`, { duration: 5000 })
                }

            }
        }, DISCOUNT_CLEANUP_DELAY_MS);
        return () => clearTimeout(delayTimeout);
    }, [cart?.cartDiscount, cart?.cartDiscounts, cart?.properties?.Employee_Email_ID, retailEmployeeDiscount, aloDiscounts]);


    useEffect(() => {
        if (annualLimit > 0 && currentSpend > annualLimit && isRetailEmployee) {
            removeCartDiscountWithRetry("over annual limit");
            setCurrentSpend(prevCurrentSpend);
            api.toast.show(`${messages.ExceedLimit}`, { duration: 6000 });
        }
    }, [currentSpend])

    const getEmployeeDetailsByEmail = async (email) => {
    //    api.toast.show(JSON.stringify(email),{duration:3000})
       const token = await api.session.getSessionToken();
        const response = await fetch(
            `${host}/pos/v1/getdetails/employee?emailId=${email}`,
            {
                method: "GET",
                mode: "cors",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            }
        );

        if (response.status === 200) {
            const data = await response.json();
            if (data.payload?.employee) {
                const employee = data?.payload?.employee;
                if (employee?.retail_employee) {
                    setIsRetailEmployee(data?.payload?.employee?.retail_employee)
                    setDiscountPercentage(employee?.employeeDiscount?.value || 0);
                    setPrevCurrentSpend(Number(employee?.current_spent) || 0);
                    setAnnualLimit(employee?.annual_limit);
                } else {
                    setSubtitle('');
                    setIsRetailEmployee(false)
                    setDiscountPercentage(0);
                    setPrevCurrentSpend(0);
                    setAnnualLimit(0);
                }
            }
        } else {
            setPrevCurrentSpend(0);
            setCurrentSpend(0);
            setAnnualLimit(0);
        }
    };
    const openModal = () => {
        api.action.presentModal();
    }
    return (
        <Tile
            title={messages.title || ''}
            subtitle={subtitle}
            enabled={edpEnable}
            onPress={openModal}
            destructive={edpEnable}
        />
    );
};

export default reactExtension('pos.home.tile.render', () => <CartProvider><App /></CartProvider>)
