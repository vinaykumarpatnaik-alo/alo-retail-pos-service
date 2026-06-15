import React, { useState, useEffect, useRef } from "react";
import {
  useApi,
  useLocaleSubscription,
  SearchBar,
  useScannerDataSubscription,
  Dialog,
  Stack,
  TextField,
  Text,
  Icon,
  ScrollView,
  Selectable,
  NumberField,
  CameraScanner,
  Box,
} from "@shopify/ui-extensions-react/point-of-sale";
import { PhoneNumberUtil } from "google-libphonenumber";
import {
  ALOTIER_1,
  ALOTIER_2,
  ALOTIER_3,
  LLTIER_1,
  LLTIER_2,
  LLTIER_3,
} from "./constants";
import { formattedMonth } from "../utils/utils";
import { validateEmail } from "./helpers/validation";
import ENjsonData from "../../locales/en.json";
import FRcajsonData from "../../locales/fr-ca.json";
import { useExtensionSession } from "../../../shared/useExtensionSession";
import { useConfig } from "../../../pos-cart-utils/context/ConfigProvider";

type CustomerType = "" | "local" | "international";

function CustomerTypeOption({
  label,
  value,
  selectedValue,
  onSelect,
}: {
  label: string;
  value: CustomerType;
  selectedValue: CustomerType;
  onSelect: (value: CustomerType) => void;
}) {
  const isSelected = selectedValue === value;
  return (
    <Selectable onPress={() => onSelect(value)}>
      <Stack direction="inline" alignItems="center">
        <Icon name={isSelected ? "radio-active" : "radio-inactive"} size="m" />
        <Text>{label}</Text>
      </Stack>
    </Selectable>
  );
}

const NewCustomer = ({
  existingUser,
  pointsUsed,
  setBirthday,
  countryCity,
  isTouristEnabled,
  isAloAccessEnabled,
  isMarketingEnabled,
  isBirthdayEnabled,
  metafieldBdayUpdate,
  storeAddress,
  setLoading,
  Host,
  onOpenSearchWindow,
  phoneNumberCode,
}) => {
  const api = useApi();
  const { name } = useApi().device;
  const host = Host;

  const { token } = useExtensionSession(api);
  let defaultIsNewCust = false;
  if (existingUser) {
    defaultIsNewCust = false;
  } else {
    defaultIsNewCust = true;
  }

  const [newCustomer, setNewCustomer] = useState(defaultIsNewCust);
  const [showDialog, setShowDialog] = useState(false);
  const [errorResult, setErrorResults] = useState("");
  const [messages, setMessages] = useState<any>("");
  const locale = useLocaleSubscription();
  const { data, source } = useScannerDataSubscription();
  const [error, setError] = useState<string | null>(null);
  const [scanDiscountDataConfig, setScanDiscountDataConfig] =
    useState<any>(null);
  const [camScanner, setCamScanner] = useState(false);
  const [searchBarKey, setSearchBarKey] = useState(0);
  const [ignoreNextSearchFocus, setIgnoreNextSearchFocus] = useState(false);

  const existingLocation = existingUser?.locationInfo
    ? {
        country: existingUser.locationInfo.Country || "",
        city: existingUser.locationInfo.City || "",
      }
    : { country: "", city: "" };
  const initialCustomerType: CustomerType = existingUser?.locationInfo?.type
    ? existingUser.locationInfo.type === "visitor"
      ? "international"
      : "local"
    : "";
  const prePickerCustomerTypeRef = useRef<CustomerType>(initialCustomerType);
  const [customerType, setCustomerType] =
    useState<CustomerType>(initialCustomerType);

  const [country, setCountry] = useState(
    initialCustomerType === "international" ? existingLocation.country : "",
  );
  const [city, setCity] = useState(
    initialCustomerType === "international" ? existingLocation.city : "",
  );
  const isInternational = customerType === "international";
  const errorMessages = {
    EMAIL_INVALID_FORMAT: `${messages.IncorrectEmail}`,
    FIELD_REQUIRED: `${messages.FieldRequired}`,
    PHONE_NUMBER_TAKEN: `${messages.PhonenumberTaken}`,
    EMAIL_TAKEN: `${messages.EmailTaken}`,
    INVALID_PHONE_NUMBER: `${messages.ValidPhoneNumber}`,
    CONSENT_NOT_SET: `${messages.MarketingConsent}`,
    COUNTRY_CITY_REQUIRED: `${messages.FieldRequired}`,
  };

  const { flags } = useConfig();
  const ageRanges = flags.ageRanges ?? [];
  const isAgeRangeEnabled = flags.showAgeRange ?? false;

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

  const defaultFname = existingUser?.firstName || "";
  const defaultLname = existingUser?.lastName || "";
  const defaultEmail = existingUser?.email || "";
  const phoneUtil = PhoneNumberUtil.getInstance();

  const extractPhoneParts = (rawPhone?: string) => {
    if (!rawPhone) {
      return {
        countryCode: "1",
        phoneNumber: "",
      };
    }

    try {
      const parsed = phoneUtil.parse(rawPhone);

      return {
        countryCode: String(parsed.getCountryCode() || ""),
        phoneNumber: String(parsed.getNationalNumber() || ""),
      };
    } catch (error) {
      const cleaned = String(rawPhone).replace(/\D/g, "");
      return {
        countryCode: "",
        phoneNumber: cleaned,
      };
    }
  };

  const buildFullPhoneNumber = (countryCode?: string, phoneNumber?: string) => {
    const cc = String(countryCode || "").replace(/\D/g, "");
    const pn = String(phoneNumber || "").replace(/\D/g, "");

    if (!pn) return ""; // phone empty => send empty
    if (!cc) return pn;
    return `+${cc}${pn}`;
  };

  const isValidNationalPhone = (value: string) => /^\d{6,15}$/.test(value);

  const defaultPhone = existingUser?.phone || "";

  const { countryCode: defaultCountryCode, phoneNumber: defaultPhoneNumber } =
    extractPhoneParts(defaultPhone);
  const defaultNewUserCountryCode = String(phoneNumberCode || "")
    .replace(/\D/g, "")
    .slice(0, 4);
  const [firstName, setFirstName] = useState({
    inputValue: defaultFname,
    errorMessage: "",
  });

  const [lastName, setLastName] = useState({
    inputValue: defaultLname,
    errorMessage: "",
  });

  const [email, setEmail] = useState({
    inputValue: defaultEmail,
    errorMessage: "",
  });

  const [phoneNumber, setPhoneNumber] = useState({
    inputValue: defaultPhoneNumber,
    errorMessage: "Enter valid phone number",
  });

  const [countryCode, setCountryCode] = useState(
    existingUser?.phone
      ? defaultCountryCode || "1"
      : defaultNewUserCountryCode || "1",
  );

  useEffect(() => {
    // Keep default code synced when prop arrives late for new users.
    if (!existingUser?.phone) {
      setCountryCode(defaultNewUserCountryCode || "1");
    }
  }, [defaultNewUserCountryCode, existingUser?.phone]);
  const [isValidPhone, setIsValidPhone] = useState(true);

  const [isValidForm, setIsValidForm] = useState({
    firstName: true,
    lastName: true,
    email: true,
  });
  let defaultFNameErrorMsg = "";
  if (!defaultFname && !newCustomer) {
    defaultFNameErrorMsg = errorMessages?.FIELD_REQUIRED;
  }

  let defaultLNameErrorMsg = "";
  if (!defaultLname && !newCustomer) {
    defaultLNameErrorMsg = errorMessages?.FIELD_REQUIRED;
  }

  let defaultEmailErrorMsg = "";
  if (!defaultEmail && !newCustomer) {
    defaultEmailErrorMsg = errorMessages?.FIELD_REQUIRED;
  }

  let aloAccessOptInDisable;
  if (existingUser?.blockedStatus) {
    aloAccessOptInDisable = true;
  } else {
    aloAccessOptInDisable = !!existingUser?.loyaltyInfo?.enroll_date;
  }
  let defaultLoyaltyOptIn = false;
  if (defaultIsNewCust) {
    defaultLoyaltyOptIn = true;
  } else {
    defaultLoyaltyOptIn = !!existingUser?.loyaltyInfo?.enroll_date;
  }
  const [isLoyaltyOptInChecked, setIsLoyaltyOptInChecked] =
    useState(defaultLoyaltyOptIn);

  let defaultMarketingInd = existingUser?.marketingInd || false;
  if (defaultIsNewCust) {
    defaultMarketingInd = true;
  }
  const [isMarketingEmailsChecked, setIsMarketingEmailsChecked] =
    useState(defaultMarketingInd);
  const [marketingConsentError, setMarketingConsentError] = useState("");
  const [countryCityError, setCountryCityError] = useState("");

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
  const [tierLevel, setTierLevel] = useState(defaultTier);

  let defaultPointBalance = existingUser?.loyaltyInfo?.points_approved || 0;
  if (!aloLLOptInFlag) {
    defaultPointBalance = 0;
  }
  if (existingUser?.blockedStatus) {
    defaultPointBalance = 0;
  }

  const [pointBalance, setPointBalance] = useState(
    defaultPointBalance - pointsUsed,
  );

  const [isCLientAddtoCart, setIsCLientAddtoCart] = useState(false);

  const fetchScanDataConfig = async () => {
    try {
      if (!token) return;

      const url = `${host}/pos/v1/scanner/scannerDiscount`;

      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setScanDiscountDataConfig(result.payload);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError("Unauthorized: Invalid session");
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchScanDataConfig(); // Initial fetch
  }, [token]);

  useEffect(() => {
    if (countryCity?.confirmed) {
      setCustomerType("international");
      setCountry(countryCity.country || "");
      setCity(countryCity.city || "");
      return;
    }

    if (existingUser?.locationInfo?.type === "visitor") {
      setCustomerType("international");
      setCountry(existingUser.locationInfo.Country);
      setCity(existingUser.locationInfo.City || "");
      return;
    }

    if (countryCity?.confirmed === false) {
      setCustomerType(prePickerCustomerTypeRef.current);
      setCountry("");
      setCity("");
    }
  }, [existingUser, countryCity]);

  // Clear country/city when user switches to local type
  useEffect(() => {
    if (customerType === "local") {
      setCountry("");
      setCity("");
    }
  }, [customerType]);

  useEffect(() => {
    if (country) {
      setCountryCityError("");
    }
  }, [country]);

  const handleFirstNameChange = (value) => {
    if (value !== "") {
      setIsValidForm((prevState) => ({
        ...prevState,
        firstName: true,
      }));
      setFirstName((prevState) => ({
        ...prevState,
        inputValue: value,
      }));
    } else {
      setIsValidForm((prevState) => ({
        ...prevState,
        firstName: false,
      }));
      setFirstName((prevState) => ({
        ...prevState,
        inputValue: value,
        errorMessage: errorMessages.FIELD_REQUIRED,
      }));
    }
  };

  const handleLastNameChange = (value) => {
    if (value !== "") {
      setIsValidForm((prevState) => ({
        ...prevState,
        lastName: true,
      }));
      setLastName((prevState) => ({
        ...prevState,
        inputValue: value,
      }));
    } else {
      setIsValidForm((prevState) => ({
        ...prevState,
        lastName: false,
      }));
      setLastName((prevState) => ({
        ...prevState,
        inputValue: value,
        errorMessage: errorMessages.FIELD_REQUIRED,
      }));
    }
  };

  const handleEmailChange = (value) => {
    const isValid = validateEmail(value); // Check if the email is valid

    setIsValidForm((prevState) => ({
      ...prevState,
      email: isValid, // Set validation result in state
    }));

    setEmail((prevState) => ({
      ...prevState,
      inputValue: value,
      errorMessage:
        value === ""
          ? errorMessages.FIELD_REQUIRED // Show required error when empty
          : isValid
            ? "" // Clear error if valid
            : errorMessages.EMAIL_INVALID_FORMAT, // Show format error if invalid
    }));
  };

  const handlePhoneNumberChange = (value: string) => {
    const digits = (value || "").replace(/\D/g, "");

    setPhoneNumber((prev) => ({
      ...prev,
      inputValue: digits,
      errorMessage: "Enter valid phone number",
    }));

    setIsValidPhone(digits.length === 0 || isValidNationalPhone(digits));
  };

  const defaultId = existingUser?.id || 0;
  const [custId, setCustId] = useState(defaultId);

  const [log, setLog] = useState("");
  type BirthdateParts = {
    year?: string;
    month?: string;
    day?: string;
  };
  //setLog(name);
  const getBirthdate = () => {
    const bDate: BirthdateParts = {};
    if (existingUser && (existingUser?.loyaltyInfo?.birthday || existingUser?.birthDate)) {
      //For tesing....
      const dateString = existingUser?.loyaltyInfo?.birthday || existingUser?.birthDate;
      let parts;
      if (dateString?.indexOf("T") !== -1) {
        parts = dateString?.split(/[-T:]/);
      } else {
        parts = dateString?.split(/[-]/);
      }
      bDate.year = parts?.[0] === "1920" ? undefined : parts?.[0];
      bDate.month = parts?.[1];
      bDate.day = parts?.[2];
    }
    return bDate;
  };

  let formatedBirthDay = getBirthdate();
  const parsedBirthYear = formatedBirthDay?.year
    ? Number(formatedBirthDay.year)
    : null;
  const [inputBirthDay, setInputBirthDay] = useState({
    year: parsedBirthYear,
    month: formatedBirthDay?.month ? Number(formatedBirthDay.month) : null,
    day: formatedBirthDay?.day ? Number(formatedBirthDay.day) : null,
  });

  const isExistingUserBirthdayComplete = (() => {
    const existingBirthday = existingUser?.loyaltyInfo?.birthday || existingUser?.birthDate;
    if (!existingBirthday) return false;

    const parts = existingBirthday.includes("T")
      ? existingBirthday.split(/[-T:]/)
      : existingBirthday.split("-");

    const year = Number(parts?.[0]);
    const month = Number(parts?.[1]);
    const day = Number(parts?.[2]);

    return (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      year !== 1920
    );
  })();

  const isBirthDayFullyEntered = !!inputBirthDay?.month && !!inputBirthDay?.day;
  const isBirthDayEmpty = !inputBirthDay?.month && !inputBirthDay?.day;

  useEffect(() => {
    if (errorResult !== "") {
      checkForErrorType(errorResult);
    }
  }, [errorResult]);

  useEffect(() => {
    if (setBirthday !== null) {
      setInputBirthDay((prevValue) => ({
        ...prevValue,
        year:
          setBirthday?.year !== undefined && setBirthday?.year !== null
            ? Number(setBirthday.year)
            : null,
        month:
          setBirthday?.month !== undefined && setBirthday?.month !== null
            ? Number(setBirthday.month)
            : null,
        day:
          setBirthday?.day !== undefined && setBirthday?.day !== null
            ? Number(setBirthday.day)
            : null,
      }));
    } else {
      setInputBirthDay((prevValue) => ({
        ...prevValue,
        year: parsedBirthYear,
        month: formatedBirthDay?.month ? Number(formatedBirthDay.month) : null,
        day: formatedBirthDay?.day ? Number(formatedBirthDay.day) : null,
      }));
    }
  }, [setBirthday]);

  const checkBirthdateChange = () => {
    const hasMonthDay = !!inputBirthDay?.month && !!inputBirthDay?.day;

    const currentBirthday = {
      month: inputBirthDay?.month ?? null,
      day: inputBirthDay?.day ?? null,
      year: hasMonthDay
        ? (inputBirthDay?.year ?? 1920)
        : null,
    };

    if (!existingUser) {
      return hasMonthDay;
    }

    const existingBirthday = existingUser?.loyaltyInfo?.birthday || existingUser?.birthDate;
    if (!existingBirthday) {
      return hasMonthDay;
    }

    const parts = existingBirthday.includes("T")
      ? existingBirthday.split(/[-T:]/)
      : existingBirthday.split("-");

    const oldBirthday = {
      year: Number(parts?.[0]) || null,
      month: Number(parts?.[1]) || null,
      day: Number(parts?.[2]) || null,
    };

    return (
      oldBirthday.year !== currentBirthday.year ||
      oldBirthday.month !== currentBirthday.month ||
      oldBirthday.day !== currentBirthday.day
    );
  };

  let isLoyaltyOptIn = false;
  if (!aloAccessOptInDisable) {
    isLoyaltyOptIn = isLoyaltyOptInChecked;
  }

  const phone = buildFullPhoneNumber(countryCode, phoneNumber.inputValue);
  const isBdayUpdated = checkBirthdateChange();
  const marketingInd = isMarketingEnabled ? isMarketingEmailsChecked : false;
  const isMarketingIndUpdated = isMarketingEnabled
    ? (existingUser?.marketingInd ?? false) !== isMarketingEmailsChecked
    : false;
  const loyaltyOptIn = isAloAccessEnabled ? isLoyaltyOptIn : false;
  const hasTouristSelection = isTouristEnabled && Boolean(customerType);
  const countryValue = !hasTouristSelection
    ? ""
    : isInternational
      ? country
      : (storeAddress?.address?.country ?? "");
  const cityValue = !hasTouristSelection
    ? ""
    : isInternational
      ? city
      : (storeAddress?.address?.city ?? "");
  const customerTypeValue = !hasTouristSelection
    ? ""
    : customerType === "international"
      ? "visitor"
      : "local";
  const storeName = storeAddress?.name ?? "";
  const locationId = storeAddress?.id?.split("/").pop() ?? "";


  // If year is not selected but month/day are, use 1920 as placeholder
  const birthdateForSubmit = {
    ...inputBirthDay,
    year: inputBirthDay.year === null && isBirthDayFullyEntered ? 1920 : inputBirthDay.year,
  };

  const customerData = {
    firstName: firstName.inputValue,
    lastName: lastName.inputValue,
    email: email.inputValue,
    phone,
    updateEnrolldate: existingUser?.updateEnrolldate,
    birthdate: birthdateForSubmit,
    isBdayUpdated,
    marketingInd,
    isMarketingIndUpdated,
    isLoyaltyOptIn: loyaltyOptIn,
    country: countryValue,
    city: cityValue,
    type: customerTypeValue,
    store_name: storeName,
    location_id: locationId,
    metafieldBdayUpdate,
  };

  const setCartLoad = (status) => {
    setIsCLientAddtoCart(status);
  };

  const checkChangeInInput = () => {
    const existingCustomerType = existingUser?.locationInfo?.type ?? "";
    const normalizedExistingCustomerType = isTouristEnabled
      ? existingCustomerType
      : "";
    const normalizedCustomerTypeValue = isTouristEnabled
      ? customerTypeValue
      : "";
    const shouldCompareCountryCity =
      isTouristEnabled && customerType === "international";
    const existingCountryForCompare = shouldCompareCountryCity
      ? (existingLocation?.country ?? "")
      : "";
    const existingCityForCompare = shouldCompareCountryCity
      ? (existingLocation?.city ?? "")
      : "";
    const countryForCompare = shouldCompareCountryCity ? country : "";
    const cityForCompare = shouldCompareCountryCity ? city : "";
    const existingFirstName = existingUser?.firstName ?? "";
    const existingLastName = existingUser?.lastName ?? "";
    const existingEmail = existingUser?.email ?? "";
    const existingPhone = existingUser?.phone ?? "";
    const existingMarketingInd = existingUser?.marketingInd ?? false;
    let isInputChanged = false;
    if (
      existingUser &&
      existingFirstName === firstName.inputValue &&
      existingLastName === lastName.inputValue &&
      existingEmail === email.inputValue &&
      normalizedExistingCustomerType === normalizedCustomerTypeValue &&
      existingCountryForCompare === countryForCompare &&
      existingCityForCompare === cityForCompare &&
      existingPhone ===
        buildFullPhoneNumber(countryCode, phoneNumber?.inputValue) &&
      existingMarketingInd === isMarketingEmailsChecked
    ) {
      isInputChanged = false;
    } else {
      isInputChanged = true;
    }
    return isInputChanged;
  };

  const handleSubmit = async () => {
    let response = null;
    if (!token) return;
    if (existingUser) {
      setLoading(true);
      const editPath = `${host}/pos/v1/customer/edit?customerId=${existingUser?.id}`;
      response = await fetch(editPath, {
        method: "POST",
        body: JSON.stringify(customerData),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } else {
      setLoading(true);
      const createPath = `${host}/pos/v1/customer/create`;
      response = await fetch(createPath, {
        method: "POST",
        body: JSON.stringify(customerData),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }

    if (response.ok) {
      setLoading(false);
      const result = await response.json();
      setCustId(result.payload);
      api.cart.setCustomer({ id: result.payload });
      closeModal();
    } else {
      setLoading(false);
      const errorResult = await response.json();
      setErrorResults(errorResult);
    }
  };

  const checkForErrorType = (errorResult) => {
    let fetchErrors: string[] = [];

    // EMAIL
    const isEmailError = errorResult?.error
      ?.trim()
      ?.toLowerCase()
      ?.includes(errorMessages?.EMAIL_TAKEN?.toLowerCase());
    if (isEmailError) {
      setIsValidForm((prev) => ({ ...prev, email: false }));
      setEmail((prev) => ({
        ...prev,
        errorMessage: errorMessages.EMAIL_TAKEN,
      }));
      fetchErrors.push(errorMessages.EMAIL_TAKEN);
    }

    // PHONE
    const lowerErr = errorResult?.error?.trim()?.toLowerCase() || "";
    const isPhoneNumberTaken = lowerErr.includes(
      errorMessages.PHONE_NUMBER_TAKEN?.toLowerCase(),
    );
    const isPhoneError =
      lowerErr.includes("phone") || lowerErr.includes("invalid");

    if (isPhoneNumberTaken) {
      setPhoneNumber((prev) => ({
        ...prev,
        errorMessage: errorMessages.PHONE_NUMBER_TAKEN,
      }));
      setIsValidPhone(false); // <-- make the field show the error
      fetchErrors.push(errorMessages.PHONE_NUMBER_TAKEN);
    } else if (isPhoneError) {
      setPhoneNumber((prev) => ({
        ...prev,
        errorMessage: errorMessages.INVALID_PHONE_NUMBER,
      }));
      setIsValidPhone(false); // <-- make the field show the error
      fetchErrors.push(errorMessages.INVALID_PHONE_NUMBER);
    }

    // CONSENT (fix key)
    const isConsentError = lowerErr.includes("marketing consent");
    if (isConsentError) {
      setMarketingConsentError(errorMessages.CONSENT_NOT_SET);
      fetchErrors.push(errorMessages.CONSENT_NOT_SET);
    } else {
      setMarketingConsentError("");
    }

    if (fetchErrors.length === 0) fetchErrors.push(errorResult);
    return fetchErrors;
  };

  const closeModal = () => {
    api.navigation.dismiss();
  };

  const keepEditing = () => {
    setShowDialog(false);
  };

  const discard = () => {
    closeModal();
  };

  let inputValid =
    firstName.inputValue !== "" &&
    lastName.inputValue != "" &&
    email.inputValue != "" &&
    isValidForm.firstName &&
    isValidForm.lastName &&
    isValidForm.email;
  let inputReadyforSave = false;
  if (existingUser) {
    let inputReqChanged;
    inputReqChanged = checkChangeInInput();
    if (inputReqChanged) {
      inputReadyforSave = true;
    } else if (isBdayUpdated) {
      inputReadyforSave = true;
    } else if (!aloAccessOptInDisable && isLoyaltyOptInChecked) {
      inputReadyforSave = true;
    }
  } else {
    if (isBirthDayEmpty || isBirthDayFullyEntered) {
      inputReadyforSave = true;
    }
  }
  const saveandClose = !(inputValid && inputReadyforSave);

  const cancel = () => {
    const isInputChanged = checkChangeInInput();
    if (!isInputChanged) {
      closeModal();
    } else if (
      firstName.inputValue !== "" ||
      lastName.inputValue !== "" ||
      email.inputValue !== "" ||
      phoneNumber.inputValue !== "" ||
      !isBirthDayEmpty
    ) {
      setShowDialog(true);
    } else {
      closeModal();
    }
  };
  useEffect(() => {
    const fetchData = async () => {
      let response = await ENjsonData.main;
      if (locale.includes("fr-CA")) {
        response = await FRcajsonData.main;
      }
      setMessages(response);
    };
    fetchData();
  }, []);
  const openSearchWindow = () => {
    // Remount SearchBar to drop active focus before navigation.
    setSearchBarKey((prev) => prev + 1);
    // Ignore the first focus event when user returns from Search screen.
    setIgnoreNextSearchFocus(true);
    if (onOpenSearchWindow) {
      onOpenSearchWindow();
    }
  };

  const handleSearchBarFocus = () => {
    if (ignoreNextSearchFocus) {
      setIgnoreNextSearchFocus(false);
      return;
    }
    openSearchWindow();
  };

  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    if (data && typeof data === "string" && data.includes("@")) {
      callsearch(data);
    } else if (data && !data.includes("@")) {
      api.toast.show("Invalid:Scan a Email Id", { duration: 3000 });
    }
  }, [data]);

  useEffect(() => {
    if (customerId) {
      api.cart.setCustomer({ id: Number(customerId) });
      api.navigation.dismiss();
      api.toast.show("Customer Added to the Cart", { duration: 3000 });
    }
  }, [customerId]);

  const extractCustomerId = (gid) => gid.split("/").pop();

  const callsearch = async (text) => {
    if (!token) return;
    text = `email:${text}`;
    const url = `${host}/pos/v1/customer/search?scanned=true`;
    try {
      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ searchString: text }),
      });
      const data = await response.json();
      if (data.customers) {
        if (data.customers.length >= 1) {
          let extractCustomer = extractCustomerId(data.customers[0].id);
          // setApplyDiscount(true);
          setCustomerId(extractCustomer);
          if (scanDiscountDataConfig?.enable) {
            api.cart.addCartProperties({
              Discount: `${scanDiscountDataConfig.discountCode}`,
            });
          }
        } else if (data.customers.length === 0) {
          api.toast.show("No Customer matched", { duration: 3000 });
        }
      } else {
        api.toast.show("No Customer", { duration: 3000 });
      }
    } catch (error) {
      api.toast.show(error, { duration: 3000 });
    }
  };

  // Fires **every keystroke**; DON’T mutate `value` here.
  const handlePhoneNumberInput = (value: string) => {
    const digits = (value || "").replace(/\D/g, "");
    setIsValidPhone(digits.length === 0 || isValidNationalPhone(digits));
  };

  const showCamScanner = () => {
    setCamScanner(true);
  };

  const handleCustomerTypeSelect = (value: CustomerType) => {
    if (value === "international") {
      prePickerCustomerTypeRef.current = customerType;
      setCustomerType(value);
      api.navigation.navigate("CountryList", {
        country,
        city,
        touristSelectionConfirmed: !!country,
      });
    } else {
      setCustomerType(value);
    }
  };

  const handlePhoneInput = (value: string) => {
    const digits = (value ?? "").replace(/\D/g, "").slice(0, 15);

    setPhoneNumber({
      inputValue: digits,
      errorMessage: "Enter valid phone number",
    });

    setIsValidPhone(true);
  };

  const handlePhoneCommit = (value: string) => {
    const digits = (value ?? "").replace(/\D/g, "").slice(0, 15);

    if (digits.length !== 0 && !isValidNationalPhone(digits)) {
      setPhoneNumber((prev) => ({
        ...prev,
        errorMessage: "Enter valid phone number",
      }));
      setIsValidPhone(false);
    }
  };

  return (
    <>
      <Stack
        direction="inline"
        gap={name !== "iPad" ? "200" : "400"}
        alignItems="center"
        alignContent="center"
        paddingInline="450"
        inlineSize={name !== "iPad" ? "95%" : "100%"}
        blockSize="80px"
      >
        {/* <Stack direction="block" gap="100"> */}
        <Box inlineSize="90%" minInlineSize="0">
          <SearchBar
            key={`new-customer-search-${searchBarKey}`}
            onSearch={openSearchWindow}
            onFocus={handleSearchBarFocus}
            placeholder={"Scan or Search customers"}
            onTextChange={openSearchWindow}
          />
        </Box>
        {/* </Stack> */}
        <Stack
          direction="inline"
          gap="600"
          alignItems="center"
          alignContent="center"
        >
          <Selectable onPress={() => showCamScanner()}>
            <Icon name="flip-camera" />
          </Selectable>
        </Stack>
      </Stack>

      {/* {name !== 'iPad' && <Stack direction="inline" alignment="center">
                            <Text children={'New Customer'} variant="sectionHeader" color="TextNeutral" />
                        </Stack>} */}
      {name !== "iPad" && (
        <Stack
          direction="inline"
          inlineSize="100%"
          alignItems="center"
          alignContent="center"
          justifyContent="center"
        >
          <Stack direction="block">
            <Text
              children={"New Customer"}
              variant="sectionHeader"
              color="TextNeutral"
            />
          </Stack>
        </Stack>
      )}

      <Stack
        direction="inline"
        gap="500"
        justifyContent="space-between"
        alignItems="center"
        alignContent="center"
        paddingInline="450"
        blockSize="60px"
        inlineSize="100%"
      >
        <Selectable onPress={cancel}>
          <Text
            children={messages.Cancel}
            variant="sectionHeader"
            color="TextInteractive"
          />
        </Selectable>
        {name == "iPad" && (
          <Selectable onPress={() => {}}>
            <Text
              children={"New Customer"}
              variant="sectionHeader"
              color="TextNeutral"
            />
          </Selectable>
        )}
        <Selectable onPress={handleSubmit} disabled={saveandClose}>
          <Text
            children={messages.SavetoCart}
            variant="sectionHeader"
            color={!saveandClose ? "TextInteractive" : "TextDisabled"}
          />
        </Selectable>
      </Stack>
      <ScrollView>
        {camScanner && (
          <Stack
            direction="inline"
            gap="500"
            justifyContent="space-between"
            alignItems="center"
            alignContent="center"
            paddingInline="450"
            blockSize="400px"
            inlineSize="100%"
          >
            <CameraScanner />
          </Stack>
        )}

        {isAloAccessEnabled && (
          <Stack
            direction="inline"
            gap="500"
            justifyContent="space-between"
            blockSize="25px"
            paddingInline="100"
          >
            <Stack direction="inline">
              <Text
                children={`${messages.Tier} :`}
                variant="sectionHeader"
                color="TextNeutral"
              ></Text>
              <Text
                children={tierLevel}
                variant="sectionHeader"
                color="TextHighlight"
              ></Text>
            </Stack>
            <Stack direction="inline">
              <Text
                children={`${messages.PointBalance} : ${newCustomer ? "" : pointBalance}`}
                variant={name === "iPad" ? "sectionHeader" : "sectionHeader"}
                color="TextNeutral"
              ></Text>
            </Stack>
          </Stack>
        )}

        <Stack direction="block" gap="100" alignContent="stretch" padding="100">
          <TextField
            label={messages.FirstName}
            value={firstName.inputValue}
            placeholder={messages.FirstNamePlaceHolder}
            onChange={(value) => handleFirstNameChange(value)}
            error={firstName.errorMessage}
            required={isValidForm.firstName}
          />

          <TextField
            label={messages.LastName}
            value={lastName.inputValue}
            placeholder={messages.LastNamePlaceHolder}
            onChange={(value) => handleLastNameChange(value)}
            error={lastName.errorMessage}
            required={isValidForm.lastName}
          />

          <TextField
            label={messages.EmailAddress}
            value={email.inputValue}
            placeholder={messages.EmailPlaceHolder}
            onChange={(value) => handleEmailChange(value)}
            error={email.errorMessage}
            required={isValidForm.email}
          />
          <Stack
            direction="inline"
            alignItems="center"
            alignContent="center"
            inlineSize="100%"
          >
            <Box inlineSize="20%" minInlineSize="0">
              <NumberField
                label={name !== "iPad" ? "(+)" : `Code(+)`}
                value={countryCode}
                onInput={(value) =>
                  setCountryCode((value || "").replace(/\D/g, "").slice(0, 4))
                }
                inputMode="numeric"
                maxLength={4}
              />
            </Box>
            <Box inlineSize="2%" />
            <Box inlineSize="78%" minInlineSize="0">
              <NumberField
                label={messages.PhoneNumber}
                placeholder={messages.PhoneNumberPlaceholder}
                value={phoneNumber.inputValue}
                inputMode="numeric"
                maxLength={15}
                required={false}
                error={!isValidPhone ? phoneNumber.errorMessage : undefined}
                onInput={handlePhoneInput}
                onChange={handlePhoneCommit}
              />
            </Box>
          </Stack>
          {isTouristEnabled && (
            <Stack
              direction={name === "iPad" ? "inline" : "block"}
              gap="0"
              alignItems={name === "iPad" ? "center" : undefined}
              paddingInline="200"
              paddingBlock="200"
            >
              <Text variant="sectionHeader">Where is this customer from?</Text>
              <Stack
                direction="inline"
                gap={name === "iPad" ? "500" : "200"}
                paddingBlock={name === "iPad" ? undefined : "200"}
              >
                <CustomerTypeOption
                  label=" Local Resident"
                  value="local"
                  selectedValue={customerType}
                  onSelect={handleCustomerTypeSelect}
                />
                <CustomerTypeOption
                  label=" Tourist/Visitor"
                  value="international"
                  selectedValue={customerType}
                  onSelect={handleCustomerTypeSelect}
                />
              </Stack>
            </Stack>
          )}

          {isTouristEnabled && customerType === "international" && (
            <Selectable
              onPress={() =>
                api.navigation.navigate("CountryList", {
                  country,
                  city,
                  touristSelectionConfirmed: !!country,
                })
              }
              disabled={customerType !== "international"}
            >
              <Stack
                direction="inline"
                gap="400"
                justifyContent="space-between"
                alignItems="center"
                alignContent="center"
                paddingInline="200"
                paddingBlock="200"
                inlineSize="100%"
              >
                <Stack direction="block" gap="100">
                  {country ? (
                    <Stack direction="block">
                      <Text
                        children="Country / City"
                        variant="captionRegular"
                        color="TextDisabled"
                      />
                      <Text variant="sectionHeader" color="TextNeutral">
                        {country}
                        {city ? `, ${city}` : ""}
                      </Text>
                    </Stack>
                  ) : (
                    <Text
                      children="Country / City"
                      variant="sectionHeader"
                      color="TextNeutral"
                    />
                  )}
                </Stack>
                <Stack
                  direction="inline"
                  gap="600"
                  alignItems="center"
                  alignContent="center"
                >
                  {country ? (
                    <Selectable
                      onPress={() => {
                        setCountry("");
                        setCity("");
                      }}
                    >
                      <Icon name="cancel" />
                    </Selectable>
                  ) : (
                    <Icon name="chevron-right" />
                  )}
                </Stack>
              </Stack>
            </Selectable>
          )}
          {isTouristEnabled &&
            customerType === "international" &&
            !!countryCityError && (
              <Text color="TextCritical" variant="captionRegular">
                {countryCityError}
              </Text>
            )}

          {isBirthdayEnabled && (
            <Selectable
              onPress={() =>
                api.navigation.navigate("ScreenTwo", {
                  month: inputBirthDay.month,
                  day: inputBirthDay.day,
                  year: inputBirthDay.year,
                })
              }
              disabled={isExistingUserBirthdayComplete}
            >
              <Stack
                direction="inline"
                gap="100"
                justifyContent="space-between"
                alignItems="center"
                alignContent="center"
                paddingInline="200"
                paddingBlock="200"
                inlineSize="100%"
              >
                <Stack direction="block" gap="100">
                  {(inputBirthDay.month && inputBirthDay.day) !== null ? (
                    <Stack direction="block">
                      <Text
                        children={messages.Birthday}
                        variant="captionRegular"
                        color="TextDisabled"
                      />
                      <Text
                        variant="sectionHeader"
                        color={
                          isExistingUserBirthdayComplete
                            ? "TextDisabled"
                            : "TextNeutral"
                        }
                      >
                        {formattedMonth(inputBirthDay.month)}
                        {" , "}
                        {inputBirthDay.day}
                        {inputBirthDay.year && inputBirthDay.year !== 1920 ? ` , ${inputBirthDay.year}` : ""}
                      </Text>
                    </Stack>
                  ) : (
                    <Text
                      children={messages.Birthday}
                      variant="sectionHeader"
                      color="TextNeutral"
                    />
                  )}
                </Stack>
                <Stack
                  direction="inline"
                  gap="600"
                  alignItems="center"
                  alignContent="center"
                >
                  <Stack direction="inline">
                    {!isExistingUserBirthdayComplete && (
                      <>
                        <Icon name="chevron-right" />
                      </>
                    )}
                  </Stack>
                </Stack>
              </Stack>
            </Selectable>
          )}
        </Stack>

        <Stack
          direction="inline"
          //   gap="100"
          justifyContent="space-between"
          alignItems="center"
          alignContent="center"
          blockSize="50px"
          paddingBlock="100"
          paddingInline={name == "iPad" ? "200" : "0"}
          inlineSize="100%"
        >
          {isAloAccessEnabled && (
            <Stack direction="inline">
              <Selectable
                onPress={() => setIsLoyaltyOptInChecked(!isLoyaltyOptInChecked)}
                disabled={
                  !newCustomer && isLoyaltyOptInChecked && defaultLoyaltyOptIn
                    ? true
                    : false
                }
              >
                <Stack direction="inline" gap="200">
                  {isLoyaltyOptInChecked ? (
                    <>
                      <Icon name="checkmark-active"></Icon>
                      <Text
                        children={messages.AloAccessOptIn}
                        variant="sectionHeader"
                        color={
                          !newCustomer &&
                          isLoyaltyOptInChecked &&
                          defaultLoyaltyOptIn
                            ? "TextDisabled"
                            : "TextNeutral"
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Icon name="checkmark-inactive"></Icon>
                      <Text
                        children={messages.AloAccessOptIn}
                        variant="sectionHeader"
                        color={"TextNeutral"}
                      />
                    </>
                  )}
                </Stack>
              </Selectable>
            </Stack>
          )}

          {isMarketingEnabled && (
            <Selectable
              onPress={() =>
                setIsMarketingEmailsChecked(!isMarketingEmailsChecked)
              }
            >
              <Stack direction="inline">
                {isMarketingEmailsChecked ? (
                  <>
                    <Icon name="checkmark-active"></Icon>
                    <Text
                      children={messages.MarketingEmails}
                      variant="sectionHeader"
                      color="TextNeutral"
                    />
                  </>
                ) : (
                  <>
                    <Icon name="checkmark-inactive"></Icon>
                    <Text
                      children={messages.MarketingEmails}
                      variant="sectionHeader"
                      color="TextNeutral"
                    />
                  </>
                )}
              </Stack>
            </Selectable>
          )}
        </Stack>
      </ScrollView>

      <Dialog
        title="Discard Changes?"
        content="You have unsaved changes"
        type="destructive"
        isVisible={showDialog}
        actionText="Discard"
        secondaryActionText="Keep Editing"
        showSecondaryAction={true}
        onAction={discard}
        onSecondaryAction={keepEditing}
      />
    </>
  );
};

export default NewCustomer;
