import React, { useState, useEffect } from 'react';
import {
  Tile, useApi, useCartSubscription,
  useLocaleSubscription, reactExtension
} from '@shopify/ui-extensions-react/point-of-sale';

import ENjsonData from '../locales/en.json';
import FRcajsonData from '../locales/fr-ca.json';
import { CartProvider, useCart } from '../../pos-cart-utils/context/CartProvider';

interface Birthday {
  month: string;
  day: string;
}

const SmartGridTile = () => {
  const api = useApi<'pos.home.tile.render'>();
  const cart = useCart();
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const locale = useLocaleSubscription();

  // ---------------------
  // Component State
  // ---------------------
  const [messages, setMessages] = useState<any>('');
  const [subtitle, setSubtitle] = useState('');
  const [tileState, setTileState] = useState(true);
  const [birthdayMessage, setBirthdayMessage] = useState<string>("");

  // Store the tags we receive from the back end
  const [customerRewardTags, setCustomerRewardTags] = useState<string[]>([]);

  // If you also need raw customer data (not just tags), you can keep a state here:
  const [customerData, setCustomerData] = useState<any>('');
  const [changeTheme, setChangeTheme] = useState(false);
  const [giftsData, setGiftsData] = useState<any>(null);

  const { currentSession } = api.session; 
  const { shopDomain, locationId } = currentSession;
  let customerId = cart?.customer?.id;
  // Determine your host
  let host = "";
  if (shopDomain.includes('dev') || shopDomain.includes('test') || shopDomain.includes('it-aloyoga')) {
    host = "https://alo.pos.shopifyapps.dev.alo.software";
  } else {
    host = "https://alo.pos.shopifyapps.alo.software";
  }

  // ---------------------
  // Fetch localized text
  // ---------------------
  useEffect(() => {
    (async () => {
      let response = ENjsonData.main; 
      if (locale.includes('fr-CA')) {
        response = FRcajsonData.main;
      }
      setMessages(response);
    })();
  }, [locale]);

  // -------------------------------
  // Update Tile Title & Subtitle
  // -------------------------------
  useEffect(() => {
    if (!messages) return;
    const hasBdayGift = birthdayMessage === "B'day Gift Available";
    if (cart?.customer?.id && parseInt(cart?.subtotal) !== 0) {
      setSubtitle(`${messages.EligibleGiftRewards}`);
      setTileState(true);
    } else if (!cart?.customer?.id && parseInt(cart?.subtotal) !== 0) {
      setSubtitle(`${messages.AddCustomer}`);
      if(hasBdayGift){
        setTileState(true);
      }else{
        setTileState(false);
      }
    } else if (cart?.customer?.id && parseInt(cart?.subtotal) === 0) {
      setSubtitle(`${messages.AddItem}`);
      if(hasBdayGift){
        setTileState(true);
      }else{
        setTileState(false);
      }
    } else {
      setSubtitle(`${messages.AddCustomerItem}`);
      setTileState(false);
    }
  }, [cart, messages, birthdayMessage]);

  // -----------------------------------------------------
  // NEW: Check reward tags for birthday logic
  // -----------------------------------------------------
  useEffect(() => {
    // First check if gift is already in cart
    if(customerData?.birthdayToastConfig?.showMessage?.BOOL){
    if (cart?.lineItems?.some(item => item.title === 'Birthday Gift')) {
        setBirthdayMessage("B'day Gift Already in cart");
        setChangeTheme(false);
        return; // Exit early if gift is in cart
    }

    const currentMonth = new Date().toLocaleString("en", { month: "long" });
    const birthdayMonthTag = customerRewardTags.find(tag => 
        tag.startsWith("BirthdayMonth:")
    );

    if (!birthdayMonthTag) {
        setBirthdayMessage("");
        setChangeTheme(false);
        return;
    }

    const [, bdayMonth] = birthdayMonthTag.split(":").map(part => part.trim());

    if (bdayMonth === currentMonth && availableQuantity > 0) {
        if (customerRewardTags.includes("EligibleForBirthdayGift")) {
            setBirthdayMessage("B'day Gift Available");
            setChangeTheme(true);
        } else {
            setBirthdayMessage("B'day Gift Redeemed already");
            setChangeTheme(false);
        }
    } else {
        setBirthdayMessage("");
        setChangeTheme(false);
    }
  }
}, [customerRewardTags, availableQuantity, cart?.lineItems,customerData]); // Added cartLineItems to dependencies


  // -----------------------------------------------------
  // Fetch data from your backend
  // -----------------------------------------------------
  const fetchCustomerRewards = async () => {
    const token = await api.session.getSessionToken();
    // For testing, using a hard-coded token
    const url = `${host}/pos/v1/customer/gifts?customerId=${customerId}`;
    try {
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
      if (result?.payload?.data?.tags) {
        setCustomerRewardTags(result.payload?.data?.tags);
        setGiftsData(result?.payload?.data?.gifts || []);
      }
    } catch (error) {
      console.error("Error fetching customer reward tags:", error);
    }
  };

  

  const fetchCustomerData = async () => {
    const token = await api.session.getSessionToken();
    // For testing, using a hard-coded token
    const url = `${host}/pos/v1/customer/getdata?customerId=${cart.customer?.id}`;
    try {
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
      setCustomerData(result?.payload);
      
    } catch (error) {
      console.error("Error fetching customer data:", error);
    }
  };

  // -----------------------------------------------------
  // Load data once a customer is attached to the cart
  // -----------------------------------------------------
  useEffect(() => {
    if (cart.customer?.id) {
      fetchCustomerData();
      fetchCustomerRewards();
    } else {
      // Clear states if no customer
      setCustomerRewardTags([]);
      setCustomerData('');
      setBirthdayMessage('');
    }
  }, [cart.customer?.id]);

  useEffect(() => {
    if (!cart.lineItems?.length || cart.customer?.id) return;

    // Remove every line that has *any* properties, except if it is a GWP line
    const toDelete = cart.lineItems.filter((line) => {
      const props    = line.properties ?? {};
      const hasProps = Object.keys(props).length > 0;

      // Shopify may serialise booleans as string or boolean
      const isGWP = props._isGWP === 'true' 
      return hasProps && !isGWP;
    });

    toDelete.forEach(async (line) => {
      try {
        await api.cart.removeLineItem(line.uuid);  // remove by UUID
      } catch (err) {
        console.log('Couldn’t remove line', line.uuid, err);
      }
    });
  }, [cart]);


  const fetchInventoryQuantity = async (variantId) => {
    const token = await api.session.getSessionToken(); // Replace with your token
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
      //api.toast.show(JSON.stringify(birthdayGifts), { duration: 3000 });

      if (birthdayGifts.length > 0) {
          // Fetch and sum inventory for all birthday gift variants
          const fetchAllQuantities = async () => {
              try {
                  const quantities = await Promise.all(
                      birthdayGifts.map(gift => fetchInventoryQuantity(gift.variant_id))
                  );
                  // Sum all the available quantities
                  const totalQuantity = quantities.reduce((sum, qty) => sum + (qty || 0), 0);
                  //api.toast.show(`Total available quantity: ${totalQuantity}`, { duration: 3000 });
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

      
  return (
    <Tile
      title={messages.AloAccess ?? "Alo Access"}
      // Combine subtitle + birthday message if it exists
      subtitle={`${subtitle}${birthdayMessage ? `\n${birthdayMessage}` : ""}`}
      onPress={() => {
        if (cart?.customer?.id && parseInt(cart?.subtotal) !== 0) {
          api.action.presentModal();
        }
      }}
      enabled={tileState}
      destructive={tileState}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <CartProvider><SmartGridTile /></CartProvider>);
