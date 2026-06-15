import React, { useState, useEffect, useRef } from "react";
import {
  useApi,
  Button,
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
  reactExtension,
  NumberField
} from "@shopify/ui-extensions-react/point-of-sale";
import ENjsonData from '../locales/en.json';
import FRcajsonData from '../locales/fr-ca.json';
import { formatIrelandNumber, formatUKNumber, formatUSNumber } from "./phonenumberFormatter";
import { CartProvider, useCart } from "../../pos-cart-utils/context/CartProvider";
import { useExtensionSession } from "../../shared/useExtensionSession";

const AppModal = () => {
  const api = useApi<'pos.home.modal.render'>();
  let cart = useCart();
  const cartRef = useRef(cart);
  const locale = useLocaleSubscription();
  const { host, token, shopDomain, locationId } = useExtensionSession(api);
  const customerId = api.cart.subscribable.initial.customer?.id;
  const staffId = api.session.currentSession.staffMemberId;
  const [authenticated, setAuthenticated] = useState<number>();
  const [message, setMessage] = useState<string>("");
  const [authorize, setAuthorize] = useState<boolean>(false);
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [phoneRaw, setPhoneRaw] = useState<string>("");
  const [isValid, setIsValid] = useState<boolean>(false);
  const [validPhone, setvalidPhone] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [apply, setApply] = useState<boolean>(false);
  const [empdata, setEmpdata] = useState<any>("");
  const [discountApplied, setDiscountApplied] = useState<boolean>(true);
  const [customValue, setCustomValue] = useState<string>("");
  const [currentCustomer, setCurrentCustomer] = useState<number>();
  const [empdiscount, setEmpdiscount] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [annualLimit, setAnnualLimit] = useState(0);
  const [currentSpent, setCurrentSpent] = useState(0);
  const [tempCartDiscount, setTempCartDiscount] = useState(false);
  const [discountData, setDiscountData] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [showLoadingText, setShowLoadingText] = useState(false);
  const [isRetailEmployee, setIsRetailEmployee] = useState(false);
  const [itemNotEligible, setItemNotEligible] = useState(false);
  const [dismissApp, setDismiss] = useState(false);
  const [failedFirstTime, setFailedFirstTime] = useState(false);
  const [testResponse, setResponse] = useState("");
  const [messages, setMessages] = useState<any>('');
  const [phoneNoConfig, setPhoneConfigData] = useState<any>("");
  const [countryCode, setCountryCode] = useState("");
  const [isPhoneFocused, setIsPhoneFocused] = useState<boolean>(false);
  const [lastVerifiedPhone, setLastVerifiedPhone] = useState<string>("");
  const [phoneResetKey, setPhoneResetKey] = useState<number>(0);
  
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const normalizeDiscountDescription = (value) => String(value || '').trim().toLowerCase();

  const getCartDiscounts = (cartData = cart) => [
    ...(cartData?.cartDiscount ? [cartData.cartDiscount] : []),
    ...(cartData?.cartDiscounts || []),
  ];

  const hasTemporaryEmployeeDiscount = (cartData = cart) => {
    const normalizedEmployeeDiscount = normalizeDiscountDescription(empdiscount);
    if (!normalizedEmployeeDiscount || cartData?.properties?.Employee_Email_ID) return false;

    return getCartDiscounts(cartData).some((discount) =>
      normalizeDiscountDescription((discount as any)?.discountDescription) === normalizedEmployeeDiscount
    );
  };

  const waitForCartProperty = async (key: string, value: string, timeoutMs = 1500) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (cartRef.current?.properties?.[key] === value) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return cartRef.current?.properties?.[key] === value;
  };

  // Here we fetch the customer data to populate the phone number
  const fetchData = async () => {
    try {
      setAuthenticated(0);
      api.session.getSessionToken().then((token) => {
        // Use the hardcoded token for local development
        fetch(
          `${host}/pos/v1/extensions/data?staffId=${staffId}&customerId=${cart?.customer?.id}`,
          {
            method: "GET",
            mode: "cors",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        )
          .then((response) => {
            if (response.status === 200) {
              response.json().then((data) => {
                if (data?.payload?.error === undefined
                  || data?.payload?.error === null
                  || data?.payload?.error?.trim().length === 0) {
                  // Check for permission
                  const permission = data?.payload?.user?.permission_enabled;
                  const valid =
                    Number(cart?.subtotal) > 1 &&
                    !(cart?.customer?.id === null || cart?.customer?.id === undefined);
                  if (permission && valid) {
                    setAuthenticated(1);
                    var value: string = data?.payload?.customer_phone;
                    //var value: string = "+11234567890";
                    //var value = "+447814879830"; // sample UK number
                    if (value) {
                      const digitsOnly: string = value.replace(/\D/g, "");
                      let modifiedCode = countryCode.replace("+", "").trim();
                      let formattedNumber = "";

                      if (modifiedCode && digitsOnly.startsWith(modifiedCode)) {
                        formattedNumber = digitsOnly.slice(modifiedCode.length);
                      }
                      const rawDigitsOnly = formattedNumber;  // Store raw before formatting
                      setPhoneRaw(rawDigitsOnly);  // Store raw digits for later use
                      const shopKey = shopDomain.split(".")[0];
                      const phoneConfig = phoneNoConfig?.[shopKey];
                      const [lengthsStr, cfgCountry] = phoneConfig || ["10", "1"];
                      const maxAllowedLength = Math.max(...lengthsStr.split(",").map(Number));

                      const pretty = formatPhoneNumber(
                        rawDigitsOnly.slice(0, maxAllowedLength),
                        maxAllowedLength,
                        cfgCountry
                      );

                      setPhone(pretty);          //  show formatted number
                      setCustomerPhone(rawDigitsOnly);
                      setIsValid(true);          //  enable Verify/Change Number
                      setvalidPhone(false);      //  start in read mode (Selectable)       // Show input field initially with raw format
                    } else {
                      let defaultnumber: string = "";
                      setPhone(defaultnumber);
                      setCustomerPhone(defaultnumber);
                      setIsValid(false);
                    }
                  } else {
                    if (valid) {
                      setAuthenticated(5);
                    } else {
                      setAuthenticated(4);
                    }
                  }
                } else {
                  setMessage(data?.payload?.error);
                  setAuthenticated(6);
                }
              });
            } else {
              setMessage(messages.TryAgain);
              setAuthenticated(3);
            }
          })
          .catch((error) => {
            console.log("Error", error.message);
            throw new Error(messages.TryAgain);

          });
      });
    } catch (error) {
      setAuthenticated(3);
      let defaultnumber: string = "";
      setPhone(defaultnumber);
      setCustomerPhone(defaultnumber);
      setIsValid(false);
      setError((error as Error).message);
      setMessage(messages.TryAgain);
    }
  };
  const fetchPhoneNoConfig = async () => {
    try {
      // const token = await api.session.getSessionToken();
      if (!token) return;
      const url = `${host}/pos/v1/edp/phoneNumberConfigs`;
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
      console.log('latest', result);
      if (result.success) {
        setPhoneConfigData(result.payload); // Update orderData with the payload from the API
        console.log(result.payload);
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
    const fetchCustomMessages = async () => {
      let response = await ENjsonData.main;
      if (locale.includes('fr-CA')) {
        response = await FRcajsonData.main;
      }
      setMessages(response)
    };
    fetchCustomMessages();
  }, []);

  useEffect(() => {
    fetchPhoneNoConfig(); // Initial fetch
  }, [token]);


  useEffect(() => {
    const shopKey = shopDomain.split(".")[0]; // Extract 'devkoraloyoga' from 'devkoraloyoga.myshopify.com'
    const phoneConfig = phoneNoConfig?.[shopKey]; // Fetch config for this shop
    if (phoneConfig) {
      const countryCode = phoneConfig[1]; // Extract country code
      setCountryCode(countryCode);
    }
  }, [phoneNoConfig])


  useEffect(() => {
    if (message) {
      if (message === 'Staff Id is mandatory. Please reach out to manager') {
        setMessage(messages.StaffIdMandatory);
      } else if (message === 'Staff Id is mandatory to find email, Email is undefined') {
        setMessage(messages.EmailUndefined)
      }
      else if (message.includes('is not found. Please review your email address in your employee profile')) {
        const words = message.split(' ');
        // Initialize arrays to hold emails and other text
        const emails: string[] = [];
        words.forEach(word => {
          if (word.includes('@aloyoga.com')) {
            emails.push(word); // Collect emails containing 'aloyoga.com'
          }
        });
        setMessage(emails[0] + ' ' + messages.ReviewEmail)
      }
      else if (message.includes('is not a valid work email. Please request your Manager to correct it in your staff profile')) {
        const words = message.split(' ');
        // Initialize arrays to hold emails and other text
        const emails: string[] = [];
        words.forEach(word => {
          if (!(word.includes('@aloyoga.com')) && (word.includes('.com'))) {
            emails.push(word); // Collect emails containing 'aloyoga.com'
          }
        });
        setMessage(emails[0] + ' ' + messages.NotWorkEmail)
      } else {
        setMessage(messages.TryAgain)
      }
    }
  }, [message])

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

    }, 750);
  };

  //to callculate current spend based on background discount added 
  useEffect(() => {
    if (tempCartDiscount) {
      const cartDiscount = cart?.cartDiscount as any;
      if (cartDiscount) {
        setDiscountData(Number(cartDiscount?.amount));
        setTempCartDiscount(false);
        removeCartDiscountWithRetry(
          "temporary spend calculation",
          () => hasTemporaryEmployeeDiscount(cartRef.current)
        );
      }
      else if (showLoadingText && (!cartDiscount || cartDiscount?.amount === 0)) { // is Retail employee and Item not eligible for discount in cart
        setShowLoadingText(false);
        setTempCartDiscount(false);
        setItemNotEligible(true); //set item is eligible for discount or not
      }
    }

  }, [tempCartDiscount, cart?.cartDiscount]);

  useEffect(() => {
    if (discountData) {
      let totalspend = (discountData / (discountPercentage / 100)) - discountData;
      setCurrentSpent(currentSpent + totalspend);
      setShowLoadingText(false);
    }
  }, [discountData])

  useEffect(() => {
    if (isRetailEmployee && annualLimit > 0 && currentSpent > annualLimit && cart?.cartDiscount) {
      removeCartDiscountWithRetry("over annual limit");
    }
  }, [isRetailEmployee, annualLimit, currentSpent, cart?.cartDiscount]);

  useEffect(() => {
    const currentCustomerId = cart.customer?.id;
    if (currentCustomerId && countryCode !== '') {
      setCurrentCustomer(currentCustomerId);
      fetchData();
    }
    else if (currentCustomerId === undefined) {
      setAuthenticated(4);
    }
  }, [cart.customer?.id, countryCode]);

  useEffect(() => {
    if (dismissApp) {
      if (cart?.cartDiscount && (cart?.cartDiscount as any)?.amount !== 0) {
        if (!cart?.properties?.Employee_Email_ID) { // rare case when item is eligible for discount so force property to add
          setFailedFirstTime(true);
          api.cart.addCartProperties({ "Employee_Email_ID": `${email}` })
        }
        api.toast.show(`${messages.DiscountApplied}`, { duration: 1000 });
      } else {
        api.toast.show(`${messages.DiscountNotApplied}`, { duration: 1000 });
      }
      setApply(false)
      addlog()
      api.navigation.dismiss();
    }
  }, [dismissApp])

  const onCancel = () => {
    // Show input field with RAW digits for easy editing
    setEmpdata("");                   // Clear employee data
    setAuthorize(false);              // Reset checkbox
    setDiscountApplied(true);         // Disable Apply button
    setLoading(false);                // Reset loading state for fresh verification
    setLastVerifiedPhone("");         // Reset so the same number can be verified again

    // Extract raw digits from currently displayed phone (could be formatted)
    const rawDigits = phone.replace(/\D/g, "");

    // Sync both states to raw format
    setPhoneRaw(rawDigits);           // Store raw digits
    setPhone(rawDigits);              // Display raw digits in input field

    // Check if the raw digits are still a valid length
    const shopKey = shopDomain.split(".")[0];
    const phoneConfig = phoneNoConfig?.[shopKey];
    const [lengthsStr] = phoneConfig || ["10", "1"];
    const allowedDigitLengths = lengthsStr.split(",").map(Number);

    // Keep validation state if number is still valid length
    // If user didn't change it, buttons should still work
    if (allowedDigitLengths.includes(rawDigits.length)) {
      setIsValid(true);               // Phone is still valid, keep button enabled
    } else {
      setIsValid(false);              // Phone became invalid, disable button
    }

    setvalidPhone(true);              // Show input field (NOT Selectable) again
  }

  //We call the employee lookup using the phone
  const onVerify = async () => {
    // Prevent multiple simultaneous calls
    if (loading) return;

    if(!token) return;

    // Check if we're already verifying this exact number
    const numericPhone = (phoneRaw || "").replace(/\D/g, "").trim();
    if (numericPhone === lastVerifiedPhone) {
      console.log("Already verified this number, skipping duplicate call");
      return;
    }

    // Set loading immediately to disable button
    setLoading(true);

    // ABSOLUTE GUARD: Check both isValid state AND actual content
    // This ensures button press does nothing if phone is empty
    if (!isValid || !numericPhone || numericPhone.length === 0) {
      // Reset loading if invalid
      setLoading(false);
      return;
    }

    // Mark this number as being verified to prevent duplicate calls
    setLastVerifiedPhone(numericPhone);

    addMetafield();
    const shopKey = shopDomain.split(".")[0];
    const phoneConfig = phoneNoConfig?.[shopKey];
    let prettyPhone = phone;                              // fallback: unchanged

    if (phoneConfig && numericPhone.length > 0) {  // Only format if phone has content
      const [lengthsStr, cfgCountry] = phoneConfig;
      const maxAllowedLength = Math.max(...lengthsStr.split(",").map(Number));
      prettyPhone = formatPhoneNumber(
        numericPhone.slice(0, maxAllowedLength),              // trim any extra digits
        maxAllowedLength,
        cfgCountry
      );
      setPhone(prettyPhone);                                  // UI shows formatted version after validation
    }
    const errorMessage = messages.TryAgain;
    const erroEmpNotFound = messages.EmployeeNotFound;
    const errorDiscountSuspended = messages.DiscountSuspended;
    
    //use the hard coded token for local development

    try {
      api.toast.show(`${messages.ValidatingPhone} ${prettyPhone}`, { duration: 1200 });
      setLoading(true);
      setApply(false);
      const response = await fetch(
        `${host}/pos/v1/extensions/employees?phone=${prettyPhone}&staffId=${staffId}&countryCode=${countryCode}`,
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
        setLoading(false);
        setvalidPhone(false);  // Hide input AFTER successful verification
        if (data?.payload?.is_same_as_pos_user) {
          setEmpdata("");
          //setError("Staff and Customer must be different");
          api.toast.show(`${messages.StaffDifferent}`, { duration: 6000 });
        } else {
          const enabled = data?.payload?.employee?.enabled;
          if (enabled) {
            setEmpdata(data.payload.employee);
            //api.toast.show(JSON.stringify(data.payload),{duration:3000});
            setDiscountPercentage(data?.payload?.employee?.employeeDiscount?.value || 0);
            setAnnualLimit(data.payload.employee?.annual_limit);
            setCurrentSpent(Number(data.payload.employee?.current_spent || 0));
            setIsRetailEmployee(data?.payload?.employee?.retail_employee);
            setEmpdiscount(data?.payload?.employee?.employeeDiscount?.discountcode);
            if (data?.payload?.employee?.retail_employee) { // retail employee and item eligible for discount in cart
              setShowLoadingText(true);
              api.cart.addCartCodeDiscount(data?.payload?.employee?.employeeDiscount?.discountcode).then(() => {
                setTempCartDiscount(true);
              });
            } else {
              //non retail employee and item not eligble for discount in cart
              setItemNotEligible(true);
            }
            if (data.payload.employee?.work_email !== undefined
              || data.payload.employee?.work_email !== null) {
              setEmail(data.payload.employee?.work_email.trim())
            } else if (data.payload.employee?.personal_email !== undefined
              || data.payload.employee?.personal_email !== null) {
              setEmail(data.payload.employee?.personal_email.trim())
            }
            //api.cart.setCustomer(customerId);

          } else {
            setEmpdata("");
            api.toast.show(errorDiscountSuspended, { duration: 6000 });
            //setError(errorMessage);
          }
        }
      } else if (response.status === 400) {
        const data = await response.json();
        setLoading(false);
        setEmpdata("");
        if (data?.error === 'Employee is eligible for EDP only in his/her home country') {
          api.toast.show(data.error, { duration: 3000 });
        } else {
          api.toast.show(erroEmpNotFound, { duration: 6000 });
        }
      }
      else {
        setLoading(false);
        setEmpdata("");
        api.toast.show(errorMessage, { duration: 6000 });
        //setError(errorMessage);
      }
    } catch (error) {
      //setError(errorMessage);
      setEmpdata("");
      setLoading(false);
      api.toast.show(errorMessage, { duration: 6000 });
    }
  };

  // Small helper with no extra deps
  function getLocalDateYYYYMMDD(timeZone: string) {
    const now = new Date();
    const y = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric" }).format(now);
    const m = new Intl.DateTimeFormat("en-GB", { timeZone, month: "2-digit" }).format(now);
    const d = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit" }).format(now);
    return `${y}-${m}-${d}`; // "YYYY-MM-DD"
  }

  //Add the meta field for availing discount
  const addMetafield = async () => {
    try {
      if (!token) return;
      if (!cart.customer?.id) {
        api.toast.show(`Customer not found`, {
          duration: 2000,
        });
        return false;
      }

      // --- build local YYYY-MM-DD using the device's IANA zone ---
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const dateStr = getLocalDateYYYYMMDD(deviceTz);

      // Use hardcoded test customer ID that exists in dev DB


      const response = await fetch(`${host}/pos/v1/extensions/metafield?customerId=${cart?.customer?.id}`, {
        method: "POST",
        mode: "cors",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ date: dateStr, tz: deviceTz }),
      })

      if (response.status === 200) {
        return true;
      } else {
        const errorText = await response.text();
        console.error('Metafield API error:', response.status, errorText);
        api.toast.show(`API Error ${response.status}`, { duration: 3000 });
        return false;
      }
    } catch (error) {
      console.error('Metafield exception:', error);
      api.toast.show(`Error: ${(error as Error).message}`, { duration: 3000 });
      return false;
    }
  }


  //Employee must be physically validated and enable the discount button after that
  //Using the same to add metafield to customer
  const onAuthorize = async () => {
    if (!isRetailEmployee || (isRetailEmployee && (currentSpent <= annualLimit))) {
      try {
        const flag = !authorize;
        setApply(true);
        setAuthorize(flag);
        const retVal = await addMetafield();
        if (retVal) {
          //only enable if metafield added successfully
          setDiscountApplied(!flag);
          setApply(false);
          //api.cart.setCustomer(customerId);
        } else {
          api.toast.show(`${messages.TryAgain}`, { duration: 1000 });
          // Error message already shown by addMetafield
          setApply(false);
          setAuthorize(false);
        }
      } catch (error) {
        console.error("onAuthorize error:", error);
        api.toast.show(`Exception: ${(error as Error).message}`, { duration: 3000 });
        setAuthorize(false);
        setApply(false);
      }
    } else {
      api.toast.show(`${messages.ExceedLimit}`, { duration: 6000 })
      removeCartDiscountWithRetry("check id over annual limit");
    }
  };

  //BE call to log the data for new relic
  const addlog = async () => {
    if (!token) return;
    //use the hard coded token for local development
    let id = "";
    let staff_email = "";
    if (empdata !== undefined && empdata !== null) {
      id = empdata.id;
      staff_email = empdata.staff_email;
    }

    const transformedItems = cart?.lineItems.map((lineItem) => {
      // Perform desired transformation on each line item
      const { title, variantId, price } = lineItem as any;
      return {
        title,
        variantId,
        price,
      };
    });

    fetch(`${host}/pos/v1/log`, {
      method: "POST",
      mode: "cors",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: id,
        phone: phone,
        customerId: customerId,
        employee_email: email,
        staff_email: staff_email,
        staffId: staffId,
        discount_code: empdiscount,
        sub_total: cart?.subtotal,
        tax: cart?.taxTotal,
        retailEmployee: isRetailEmployee,
        isFailedFirstTime: failedFirstTime,
        isItemInCartNotEligible: itemNotEligible,
        items: transformedItems,
        locale: locale,
        shopDomain: shopDomain
      }),
    })
      .catch(error => {
        console.error("Error:", error);
      });
  }

  //Applying the discount to cart and add properties for reporting
  const onApplyDiscount = async () => {
    setApply(true);
    try {
      if (isRetailEmployee && Number(annualLimit) > 0 && Number(currentSpent) > Number(annualLimit)) {
        await removeCartDiscountWithRetry("apply over annual limit");
        api.toast.show(`${messages.ExceedLimit}`, { duration: 6000 });
        setApply(false);
        return;
      }

      if (cart?.cartDiscount) {
        await api.cart.removeCartDiscount();
      }

      if (!itemNotEligible) { //item eligible for discount in cart
        await api.cart.addCartProperties({ "Employee_Email_ID": `${email}` });

        const propertyAdded = await waitForCartProperty("Employee_Email_ID", `${email}`);
        if (!propertyAdded) {
          throw new Error("Employee discount cart property did not sync");
        }
      }

      await api.cart.addCartCodeDiscount(empdiscount);
      setDismiss(true);
    } catch (error) {
      console.error("Error applying employee discount", error);
      api.toast.show(`${messages.TryAgain}`, { duration: 6000 });
      setApply(false);
    }
  }



  const formatPhoneNumber = (numericValue: string, maxAllowedLength: number, countryCode: string) => {
    // Guard: never format empty input
    if (!numericValue || numericValue.trim().length === 0) {
      return "";
    }

    if (maxAllowedLength === 9) {
      return `(${numericValue.slice(0, 2)})-${numericValue.slice(2, 5)}-${numericValue.slice(5, 9)}`;
    } else if (maxAllowedLength === 10) {
      return `(${numericValue.slice(0, 3)})-${numericValue.slice(3, 6)}-${numericValue.slice(6, 10)}`;
    } else if (maxAllowedLength === 11) {
      return `(${numericValue.slice(0, 3)})-${numericValue.slice(3, 7)}-${numericValue.slice(7, 11)}`;
    } else if (maxAllowedLength === 12) {
      return `(${numericValue.slice(0, 3)})-${numericValue.slice(3, 6)}-${numericValue.slice(6, 12)}`;
    } else {
      return numericValue.slice(0, maxAllowedLength); // Generic fallback
    }
  };


  const changePhoneumber = (value: string) => {
    const numericValue = value.replace(/\D/g, "");

    const shopKey = shopDomain.split(".")[0];
    const phoneConfig = phoneNoConfig?.[shopKey];

    const [lengthsStr] = phoneConfig || ["10", "1"];
    const allowedDigitLengths = lengthsStr.split(",").map(Number);
    const maxAllowedLength = Math.max(...allowedDigitLengths);

    if (numericValue.length > maxAllowedLength) {
      const clamped = numericValue.slice(0, maxAllowedLength);

      setPhoneRaw(clamped);

      // Format before switching to read mode
      const formatted = formatPhoneNumber(
        clamped,
        maxAllowedLength,
        countryCode
      );

      setPhone(formatted);

      setIsValid(true);        // keep buttons enabled
      setvalidPhone(false);    // switch to Selectable

      return;
    }

    setPhoneRaw(numericValue);
    setPhone(numericValue);

    setIsValid(allowedDigitLengths.includes(numericValue.length));
  };


  // ─────────────────────────────────────────────────────────────────────────────
  // Focus handler – show raw digits for easy editing
  // ─────────────────────────────────────────────────────────────────────────────
  const handlePhoneFocus = () => {
    // Switch to raw format when user focuses on the field
    setIsPhoneFocused(true);
    setPhone(phoneRaw);
  };


  // ─────────────────────────────────────────────────────────────────────────────
  const handlePhoneBlur = () => {
    setIsPhoneFocused(false);
    const digits = phoneRaw;                              // use raw digits, not formatted
    const shopKey = shopDomain.split('.')[0];
    const phoneConfig = phoneNoConfig?.[shopKey];

    // Fallback to 10 digits (US standard) if config not loaded
    const [lengthsStr, countryCode] = phoneConfig || ["10", "1"];
    const allowedDigitLengths = lengthsStr.split(",").map(Number);
    const maxAllowedLength = Math.max(...allowedDigitLengths);
    if (allowedDigitLengths.includes(digits.length)) {
      const pretty = formatPhoneNumber(digits, maxAllowedLength, countryCode);
      setPhone(pretty);                                     // save masked #
    } else {
      setPhone(digits);                                     // keep unformatted partial input
    }
  };

  return (
    <Navigator>
      <Screen name="ScreenOne" title={`${messages.title}`}>
        {/* <Text children={JSON.stringify(shopDomain)} /> */}
        {/* <Text children={JSON.stringify(cart)} /> */}
        {/* <Text children={JSON.stringify(cart)} />
        <Text children={JSON.stringify(customerId)} />
        <Text children={JSON.stringify(staffId)} /> */}
        <ScrollView>
          {authenticated === 4 && (
            <Banner
              title={messages.AddCustomer}
              variant="information"
              visible
              onPress={() => api.navigation.dismiss()}
            />
          )}
          {authenticated === 3 && (
            <Banner
              title={message}
              variant="error"
              visible
              action="Retry"
              onPress={() => fetchData()}
            />
          )}
          {authenticated === 5 && (
            <Banner
              title={messages.ManagerRequired}
              variant="information"
              visible
              onPress={() => api.navigation.dismiss()}
            />
          )}
          {authenticated === 2 && (
            <Banner
              title={messages.VerifyPermission}
              variant="information"
              visible
              onPress={() => api.navigation.dismiss()}
            />
          )}
          {authenticated === 6 && (
            <>
              <Banner
                title={message}
                variant="information"
                visible
                onPress={() => api.navigation.dismiss()}
              />
              <Banner
                title={messages.ManagerRequired}
                variant="information"
                visible
                onPress={() => api.navigation.dismiss()}
              />
            </>
          )}
          {error !== "" && (
            <Banner title={error} variant="error" visible action="Close" />
          )}
          {authenticated === 1 && (

            <>

              <Stack direction="block" padding="200">
                <Text variant="captionRegular">
                  {messages.EmployeeLookup}
                </Text>
              </Stack>
              {/* <Text variant="captionRegular">
                    {JSON.stringify(cart)}
                  </Text> */}
              {validPhone ? <NumberField
                key={phoneResetKey}
                label={messages.EmployeePhone}
                placeholder="(___)-___-____"
                inputMode="numeric"
                maxLength={(() => {
                  const _cfg = phoneNoConfig?.[shopDomain.split(".")[0]];
                  // Set maxLength high enough to accommodate formatted numbers
                  // e.g., "1234567890" (10 digits) formats to "(123)-456-7890" (14 chars)
                  return _cfg ? Math.max(...(_cfg[0].split(",").map(Number))) + 5 : 15;
                })()}
                value={phone}
                error={!isValid ? messages.InvalidPhone : undefined}
                onInput={changePhoneumber}
                onChange={changePhoneumber}
                onFocus={handlePhoneFocus}
                onBlur={handlePhoneBlur}
              />
                :
                <Selectable onPress={() => onCancel()} disabled={!isValid}>
                  <Stack direction="inline" gap="200" justifyContent="center" padding="200">
                    <Stack direction="block">
                      <Text>
                        {phone}
                      </Text>
                    </Stack>
                    <Stack direction="block">
                      <Icon name="staff"></Icon></Stack>
                  </Stack>
                </Selectable>
              }


              <Stack direction="inline" flexChildren padding="200">
                <Button
                  title={messages.VERIFY}
                  type="primary"
                  isDisabled={!isValid || loading}
                  onPress={onVerify}
                  isLoading={loading}
                />
              </Stack>
              <Stack direction="inline" flexChildren padding="200" blockSize="90px">
                <Button
                  title={messages.CHANGENUMBER}
                  type="basic"
                  isDisabled={!isValid}  // only enable if there's something valid to change
                  onPress={() => onCancel()}  //Calls onCancel() function

                />
              </Stack>

            </>

          )}
          {authenticated === 0 && <Stack direction="inline" gap="200" justifyContent="center" padding="100">
            <Stack direction="block">
              <Text variant="captionRegular">
                {messages.Loading}
              </Text>

            </Stack>

          </Stack>}
          {empdata !== "" && empdata !== "Not found" && (
            <Section>

              <Stack direction="inline" gap="100" justifyContent="center" padding="100" blockSize="50px">
                <Stack direction="block">
                  <Icon name="add-customer"></Icon>
                </Stack>
                <Stack direction="block">
                  <Text variant="sectionHeader" color="TextHighlight">
                    {messages.EmployeeInformation}
                  </Text>
                </Stack>

              </Stack>

              <Stack direction="inline" gap="200" justifyContent="center" padding="100">
                <Stack direction="block">
                  <Text variant="headingSmall">{messages.Name}       :</Text>
                </Stack>
                <Stack direction="block">
                  <Text variant="headingSmall" color="TextSubdued">
                    {empdata.formatted_name}
                  </Text>
                </Stack>
              </Stack>
              <Stack direction="inline" gap="200" justifyContent="center" padding="100">
                <Stack direction="block">
                  <Text variant="headingSmall">{messages.JobTitle} :</Text>
                </Stack>
                <Stack direction="block">
                  <Text variant="headingSmall" color="TextSubdued">
                    {empdata.job_title}
                  </Text>
                </Stack>
              </Stack>
              <Stack direction="inline" gap="200" justifyContent="center" padding="100">
                <Stack direction="block">
                  <Text variant="headingSmall">{messages.Location} :</Text>
                </Stack>
                <Stack direction="block">
                  <Text variant="headingSmall" color="TextSubdued">
                    {empdata.store}
                  </Text>
                </Stack>
              </Stack>
              {isRetailEmployee && <Stack direction="inline" gap="200" justifyContent="center" padding="100" blockSize="50px">
                <Stack direction="block"><Text variant="headingSmall">{messages.CurrentSpend} / {messages.AnnualLimit} :</Text></Stack>
                <Stack direction="block"><Text variant="headingSmall" color="TextSubdued">
                  {showLoadingText ? `${messages.loading}` : currentSpent} / {annualLimit}
                </Text></Stack>
              </Stack>}

              {!showLoadingText && isRetailEmployee && <><Selectable onPress={() => onAuthorize()}>
                <Stack direction="inline" gap="200" justifyContent="center" padding="200" alignContent="center" alignItems="center">
                  <Stack direction="inline" justifyContent="center" gap="200" alignContent="center" alignItems="center">
                    <Text>{messages.PleasecheckID}</Text>
                    {(authorize && <Icon name="checkmark-active" />) ||
                      (!authorize && <Icon name="checkmark-inactive" />)}
                  </Stack>
                </Stack>
              </Selectable>
                <Stack direction="inline" gap="200" justifyContent="center" padding="200">
                  <Button
                    title={messages.APPLYDISCOUNT}
                    onPress={() => onApplyDiscount()}
                    isDisabled={discountApplied}
                    type="primary"
                    isLoading={apply}
                  />
                </Stack></>}
              {!isRetailEmployee && <><Selectable onPress={() => onAuthorize()}>
                <Stack direction="inline" gap="200" justifyContent="center" padding="200" alignContent="center" alignItems="center">
                  <Stack direction="inline" justifyContent="center" gap="200" alignContent="center" alignItems="center">
                    <Text>{messages.PleasecheckID}</Text>
                    {(authorize && <Icon name="checkmark-active" />) ||
                      (!authorize && <Icon name="checkmark-inactive" />)}
                  </Stack>
                </Stack>
              </Selectable>
                <Stack direction="inline" gap="200" justifyContent="center" padding="200">
                  <Button
                    title={messages.APPLYDISCOUNT}
                    onPress={() => onApplyDiscount()}
                    isDisabled={discountApplied}
                    type="primary"
                    isLoading={apply}
                  />
                </Stack></>}

            </Section>
          )}
          {empdata !== "" && empdata === "Not found" && (
            <Section>

              <Stack direction="inline" gap="200" justifyContent="center" padding="200">
                <Icon name="add-customer"></Icon>
                <Text variant="sectionHeader" color="TextHighlight">
                  {messages.EmployeeInformation}
                </Text>
              </Stack>
              <Stack direction="inline" gap="200" justifyContent="center" padding="200">
                <Text variant="headingLarge" color="TextSubdued">
                  {messages.EmployeeNotFound}
                </Text>
              </Stack>

            </Section>
          )}
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => <CartProvider><AppModal /></CartProvider>);
