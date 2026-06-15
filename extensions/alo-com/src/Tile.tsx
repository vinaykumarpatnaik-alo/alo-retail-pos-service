import React, { useEffect, useState } from "react";
import {
  Tile,
  reactExtension,
  useApi,
} from "@shopify/ui-extensions-react/point-of-sale";
import {
  CartProvider,
  useCart,
} from "../../pos-cart-utils/context/CartProvider";
import { useExtensionSession } from "../../shared/useExtensionSession";
import { ALOTIER_3 } from "../../add-signup-customer/src/components/constants";
import {
  ConfigProvider,
  useConfig,
} from "../../pos-cart-utils/context/ConfigProvider";

const TileComponent = () => {
  const api = useApi<"pos.home.tile.render">();
  const cart = useCart();
  const { currentSession } = api.session;
  const staffId = currentSession.staffMemberId;
  const [customerData, setCustomerData] = useState<any>("");
  const [staffAuthStatus, setStaffAuthStatus] = useState<
    "ACTIVE" | "TERMINATED" | null
  >(null);
  const { host, token, shopDomain, locationId } = useExtensionSession(api);
  const configState = useConfig();
  const { flags, refreshFlags } = configState;
  const allAccessBannerEnabled = flags?.allAccessBannerEnabled || false;
  const isTierBasedLoyalty = flags?.isTierBasedLoyalty || false;
  const minimumLoyaltyPoints: number =
    (flags?.minimumLoyaltyPoints as number) || 0;

  // Validate staff silently (no modal, no toast)
  const validateStaff = async () => {
    //api.toast.show(JSON.stringify(staffId), { duration: 3000 })
    if (!staffId) return;

    // const token = await api.session.getSessionToken();
    const url = `${host}/pos/v1/getStaffDetails/data?staffId=${staffId}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) throw new Error("Staff validation failed");
      const data = await res.json();

      if (
        data?.payload?.status === "ERROR" ||
        data?.payload?.status === "TERMINATED"
      ) {
        api.action.presentModal();
      }
    } catch (err) {
      console.error("Staff validation error:", err);
      //api.toast.show(JSON.stringify('Employee profile not updated'),{duration:1000})
      //setStaffAuthStatus('TERMINATED'); // silently track
      //api.action.presentModal();
    }
  };

  const fetchCustomeData = async () => {
    if (!token) return;
    // const token = await api.session.getSessionToken();
    await refreshFlags(); // Ensure we have the latest config before fetching customer data
    const url = `${host}/pos/v1/customer/getdata?customerId=${cart?.customer?.id}`;
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
    //setLog(JSON.stringify(result));
    if (response.ok) {
      const customerInfo = result?.payload;
      setCustomerData(customerInfo);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (cart.customer?.id) {
      fetchCustomeData();
    }
  }, [cart.customer?.id, token]);

  useEffect(() => {
    if (staffId) {
      validateStaff();
    }
  }, [staffId]);

  const checkAllAccessEligibility = () => {
    if (allAccessBannerEnabled) {
      if (
        isTierBasedLoyalty &&
        customerData.loyaltyInfo?.loyalty_tier === ALOTIER_3
      ) {
        return true;
      } else {
        let customerPoints = customerData?.loyaltyInfo?.points_lifetime || 0;
        if (!isTierBasedLoyalty && customerPoints >= minimumLoyaltyPoints) {
          return true;
        } else {
          return false;
        }
      }
    } else {
      return false;
    }
  };

  // Optional: show toast only for phone validation
  useEffect(() => {
    if (!(shopDomain.includes("dev2") || shopDomain.includes("alo-yoga"))) {
      if (
        customerData?.phone === "" &&
        customerData?.phoneValidationConfig?.showMessage?.BOOL
      ) {
        api.toast.show(customerData.phoneValidationConfig.message?.S, {
          duration: Number(customerData.phoneValidationConfig.timer?.S),
        });
      }
    }
    if (checkAllAccessEligibility()) {
      const customerWithBannerInfo = {
        ...customerData,
        showAllAccessBanner: true,
      };
      api.storage.set("ALL_ACCESS_CUSTOMER_INFO", customerWithBannerInfo);
      api.action.presentModal();
    } else {
      api.storage.set("ALL_ACCESS_CUSTOMER_INFO", null);
    }
  }, [customerData]);

  return (
    <Tile
      title="ALO"
      // no subtitle, no modal
    />
  );
};

function TileWrapper() {
  const api = useApi();
  const { shopDomain } = useExtensionSession(api);

  return (
    <CartProvider>
      <ConfigProvider api={api} shopDomain={shopDomain}>
        <TileComponent />
      </ConfigProvider>
    </CartProvider>
  );
}

export default reactExtension("pos.home.tile.render", () => <TileWrapper />);
