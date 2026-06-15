import React, { useState, useEffect } from 'react';
import {
  useApi, useCartSubscription,
  reactExtension, Navigator, Text
} from '@shopify/ui-extensions-react/point-of-sale';

import { CustomerReward } from './components/CustomerReward';
import { CartProvider,useCart } from '../../pos-cart-utils/context/CartProvider';

const SmartGridModal = () => {
  const api = useApi<'pos.home.modal.render'>();
  const cart = useCart();
  const initialCartData = {
    isLoading: true,
    cartInfo: null,
    isValidInput: true,
  };
  const [cartData, setCartData] = useState(initialCartData);

  let tempCart = null;

  const customerId = cart?.customer?.id;

  if (customerId) {
    tempCart = {
      customerId: cart?.customer?.id || "",
      firstName: cart?.customer?.firstName,
      lastName: cart?.customer?.lastName,
      email: cart?.customer?.email || "",
      grandTotal: cart?.grandTotal || 0,
      subtotal: cart?.subtotal || 0,
      tags: cart?.customer?.tags || [],
      cartDiscount: cart?.cartDiscount,
      lineItems: cart?.lineItems,
    };
    //setCartData(tempCart);
  }
  let validInput = true;
  if (!customerId || !tempCart?.email) {
    validInput = false;
  }


  useEffect(() => {
    if (customerId) {
      // api.toast.show('heel',{duration:3000})
      setCartData({
        isLoading: false,
        cartInfo: tempCart,
        isValidInput: validInput,
      });
    }

  }, [cart?.customer?.id]);
  //api.toast.show(JSON.stringify(cartData),{duration:3000});
  return (
    <Navigator>

      <CustomerReward cartData={cartData?.cartInfo} />
    </Navigator>
  );
}

export default reactExtension('pos.home.modal.render', () => <CartProvider><SmartGridModal /></CartProvider>)
