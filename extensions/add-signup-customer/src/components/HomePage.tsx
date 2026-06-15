import React, { useState, useEffect, useReducer } from 'react';
import {
  useApi,
  Screen,
  useCartSubscription,
  useLocaleSubscription,
} from '@shopify/ui-extensions-react/point-of-sale';
import {
  DATA_RESET,
  UPDATE_CUSTOMERID,
  NO_CUSTOMERID,
  LOAD_CUSTOMERDATA,
  LOADING_CUSTOMERERROR,
  ENV_LOADED,
  UPDATE_POINTSUSED,
} from "./constants";

import NewCustomer from './NewCustomer';
import ENjsonData from '../../locales/en.json';
import FRcajsonData from '../../locales/fr-ca.json';
import SearchCustomerScreen from './SearchCustomerScreen';
import { useExtensionSession } from '../../../shared/useExtensionSession';
import { useConfig } from '../../../pos-cart-utils/context/ConfigProvider';

const customerReducer = (state, action) => {
  const { type, payload } = action;

  switch (type) {
    case DATA_RESET:
      return {
        ...state,
        isCartFetched: false,
        customerId: "",
        isLoading: false,
        customerData: null,
        isError: false,
      };
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
    case ENV_LOADED:
      return {
        ...state,
        envs: payload,
        isEnvLoaded: true,
      };
    default:
      return { ...state };
  }
};

const HomePage = ({ Host }) => {
  const api = useApi<'pos.home.modal.render'>();

  const host = Host;
  const locale = useLocaleSubscription();
  const { token, shopDomain, locationId } = useExtensionSession(api);

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
  const cart = useCartSubscription();
  const [state, dispatch] = useReducer(customerReducer, initialLoad);
  const [log, setLog] = useState('');
  const [isloading, setLoading] = useState(false);
  const [customerBirthday, setCustomerBirthday] = useState(null);
  const [messages, setMessages] = useState<any>('');
  const [searched, setSearched] = useState('');
  const [countryCity, setCountryCity] = useState({ country: '', city: '', confirmed: null });
  const [storeAddress, setStoreAddress] = useState(null);

  // Feature flags from config API — fetched once at app startup by ConfigProvider
  const { flags, isLoading: configLoading } = useConfig();
  const isTouristEnabled = flags.showLocalTourist;
  const isAloAccessEnabled = flags.showAloAccessOptIn;
  const isBirthdayEnabled = flags.showBday;
  const isMarketingEnabled = flags.showMarketingEmails;
  const metafieldBdayUpdate = flags.metafieldBdayUpdate;
  const isAgeRangeEnabled = flags.showAgeRange;
  
  const phoneNumberCode = flags.phoneNumberCode;
  useEffect(() => {
    let cartCustId;

    cartCustId = cart?.customer?.id;

    if (cartCustId) {
      dispatch({ type: UPDATE_CUSTOMERID, payload: cartCustId });
      if (cart?.lineItems) {
        let isLoyaltyRewardPresent = cart.lineItems
          .map((a) => a.properties)

          .filter((x) => x).flat().reduce((accumulator, item) => {
            const loyaltyReward = item._LoyaltyReward;
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

      }
    } else {
      dispatch({ type: NO_CUSTOMERID });
    }
  }, [cart]);

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
    if (response.ok) {
      dispatch({ type: LOAD_CUSTOMERDATA, payload: result });
    } else {
      dispatch({ type: LOADING_CUSTOMERERROR });
    }
  };

  const fetchStoreAddress = async () => {
    if (!token) return;
    const url = `${host}/pos/v1/store/address?locationId=${locationId}&shop=${shopDomain}`;
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (response.ok) {
      const result = await response.json();
      if (result?.success) {
        setStoreAddress(result?.payload ?? null);
      }
    }
  };

  const handleOpenSearchWindow = () => {
    //api.toast.show('sdfff', { duration: 3000 });
    api.navigation.navigate('SearchCustomer');
  };

  useEffect(() => {
     if (!token) return;
    if (state.customerId) {
      fetchCustomeData();
}
  }, [state.customerId, token]);

  useEffect(() => {
    if (!token || !locationId) return;
    fetchStoreAddress();
  }, [token, locationId]);

  const handleScreenOneParams = (params) => {
    if (params && ('month' in params || 'day' in params)) {
      if (params?.month && params?.day) {
        setCustomerBirthday(params);
      } else {
        setCustomerBirthday(null);
      }
    }

    if (params && 'touristSelectionConfirmed' in params) {
      const confirmed =
        params?.touristSelectionConfirmed === true ||
        params?.touristSelectionConfirmed === 'true';

      if (confirmed) {
        setCountryCity({
          country: params?.country || '',
          city: params?.city || '',
          confirmed: true,
        });
      } else {
        setCountryCity({ country: '', city: '', confirmed: false });
      }
    }
  };

  const isNewCustomer = state.isCartFetched && !state.customerId;
  const isExistingCustomer = state.isCartFetched && !!state.customerId && !state.isLoading;
  // Include configLoading so NewCustomer never renders with stale defaults
  const loading = !state.isCartFetched || state.isLoading || configLoading;

  // Compute props for NewCustomer in one place
  const newCustomerProps = {
    existingUser: isExistingCustomer ? state?.customerData?.payload : null,
    pointsUsed: state?.rewardPointsSelected,
    setBirthday: customerBirthday && customerBirthday,
    countryCity: countryCity,
    isTouristEnabled: isTouristEnabled,
    isAloAccessEnabled: isAloAccessEnabled,
    isMarketingEnabled: isMarketingEnabled,
    isBirthdayEnabled: isBirthdayEnabled,
    metafieldBdayUpdate: metafieldBdayUpdate,
    phoneNumberCode: phoneNumberCode,
    storeAddress: storeAddress,
    isLoading: isloading,
    setLoading: setLoading,
    Host: host,
    onOpenSearchWindow: handleOpenSearchWindow,
    isAgeRangeEnabled: isAgeRangeEnabled,
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
  }, []);

  const extractCustomerId = (gid) => gid.split('/').pop();
  const addCustomerToCart = (customerId) => {
    api.cart.setCustomer({
      id: Number(customerId)
    })
    api.navigation.dismiss();
    api.toast.show('Customer Added to Cart', { duration: 3000 })
  };

  return (
    <>
      <Screen
        name="ScreenOne"
        title={!state.customerId ? `${messages.AddCustomer}` : `${messages.EditCustomer}`}
        onReceiveParams={handleScreenOneParams}
        isLoading={loading || isloading}
      >
        {/* <Text children={JSON.stringify(log)}/> */}
        {(isNewCustomer || isExistingCustomer) && <NewCustomer {...newCustomerProps} />}
      </Screen>
      <SearchCustomerScreen
        host={host}
        api={api}
        setSearched={setSearched}
        addCustomerToCart={addCustomerToCart}
        extractCustomerId={extractCustomerId}
      />
    </>
  );
};

export default HomePage;
