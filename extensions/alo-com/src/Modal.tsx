import { useEffect, useState } from "react";
import {
  Text,
  reactExtension,
  useApi,
  Stack,
  Box
} from "@shopify/ui-extensions-react/point-of-sale";
import {
  CartProvider,
  useCart,
} from "../../pos-cart-utils/context/CartProvider";
import {
  ALOTIER_3
} from "../../add-signup-customer/src/components/constants";
import { AllAccessBanner } from "./components/AllAccessBanner";
import { useExtensionSession } from "../../shared/useExtensionSession";

const Modal = () => {
  const api = useApi<"pos.home.modal.render">();
  const cart = useCart();
  const { currentSession } = api.session;
  // const { shopDomain } = currentSession;
  const staffId = currentSession.staffMemberId;

  const { token, shopDomain, locationId } = useExtensionSession(api);

  const [staffAuthStatus, setStaffAuthStatus] = useState<
    "ACTIVE" | "TERMINATED" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<any>("");
  const [isAllAccessCustomer, setIsAllAccessCustomer] = useState(false);

  const host =
    shopDomain.includes("dev") ||
    shopDomain.includes("test") ||
    shopDomain.includes("it-aloyoga")
      ? "https://alo.pos.shopifyapps.dev.alo.software"
      : "https://alo.pos.shopifyapps.alo.software";

  const validateStaff = async () => {
    if (!staffId) return;

    try {
      const token = await api.session.getSessionToken();
      const url = `${host}/pos/v1/getStaffDetails/data?staffId=${staffId}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      const data = await res.json();
      console.log("Staff validation response:", data);

      if (!res.ok || data.success === false) {
        setErrorMessage(data.payload?.message || "Staff validation failed");
        return;
      }
      setStaffAuthStatus(data.payload?.status || null);
      if (data?.payload?.status !== "ACTIVE") {
        setErrorMessage(data.payload?.message || null);
      }
    } catch (err) {
      console.error("Staff validation error:", err);
      // setErrorMessage("Staff validation failed"); // fallback
    }
  };

  useEffect(() => {
    if (!cart?.customer?.id) return;
    const AloAccessCustomerInfo = api.storage.get("ALL_ACCESS_CUSTOMER_INFO");
    AloAccessCustomerInfo?.then((res: any) => {
      if (res?.showAllAccessBanner) {
        setCustomerData(res);
        setIsAllAccessCustomer(true);
      }
      else{
        setIsAllAccessCustomer(false);
      }
    });
  }, [cart?.customer?.id]);

  useEffect(() => {
    validateStaff();
  }, [staffId]);

  useEffect(() => {
    if (
      (errorMessage === "Staff is active" ||
        errorMessage === "Staff excluded") &&
      !isAllAccessCustomer
    ) {
      api.navigation.dismiss();
    }
  }, [errorMessage]);


  const EmployeeErrorBlock = () => {
    return (
      <>
        <Box
          blockSize="100px"
          inlineSize="100px"
          paddingInlineStart="100"
          paddingInlineEnd="100"
          paddingBlockEnd="100"
          paddingBlockStart="100"
        ></Box>
        <Box
          blockSize="100px"
          inlineSize="100px"
          paddingInlineStart="100"
          paddingInlineEnd="100"
          paddingBlockEnd="100"
          paddingBlockStart="100"
        ></Box>
        <Box
          blockSize="100px"
          inlineSize="100px"
          paddingInlineStart="100"
          paddingInlineEnd="100"
          paddingBlockEnd="100"
          paddingBlockStart="100"
        ></Box>

        <Stack
          direction="block"
          gap="200"
          justifyContent="center"
          alignContent="center"
          alignItems="center"
          inlineSize="100%"
          paddingInline="450"
          blockSize="100%"
        >
          {errorMessage && (
            <Text
              color={
                staffAuthStatus === "TERMINATED"
                  ? "TextCritical"
                  : "TextWarning"
              }
            >
              {errorMessage}
            </Text>
          )}
        </Stack>
      </>
    );
  };

  return (
    <>
      {errorMessage ? <EmployeeErrorBlock /> : null}
      {isAllAccessCustomer ? (
        <AllAccessBanner
          customerName={`${customerData?.firstName} ${customerData?.lastName}`}
          points={`${customerData?.loyaltyInfo?.points_lifetime}`}
        />
      ) : null}
    </>
  );
};

export default reactExtension("pos.home.modal.render", () => {
  return (
    <CartProvider>
      <Modal />
    </CartProvider>
  );
});
