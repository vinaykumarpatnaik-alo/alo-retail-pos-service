// utils/cart-context.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import {useApi} from '@shopify/ui-extensions-react/point-of-sale';
import {makeStatefulSubscribable} from '@remote-ui/async-subscription';
import type {Cart} from '../types/Cart';

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const CartContext = createContext<Cart | null>(null);

export const useCart = () => {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart must be used inside <CartProvider>');
  return cart;
};

/* ------------------------------------------------------------------ */
/*  Module-level singleton                                            */
/* ------------------------------------------------------------------ */

/** Shared across every extension that imports this file */
let sharedStatefulCart:
  | ReturnType<typeof makeStatefulSubscribable<Cart>>
  | null = null;

function getSharedStatefulCart(apiCartSubscribable: any) {
  if (!sharedStatefulCart) {
    sharedStatefulCart = makeStatefulSubscribable(apiCartSubscribable);
  }
  return sharedStatefulCart;
}

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  children: ReactNode;
}

/**
 * Wrap your extension UI with <CartProvider> to access a
 * stable, up-to-date cart via `useCart()` without creating
 * duplicate subscriptions or new cart objects per extension.
 */
export function CartProvider({children}: Props) {
  //   use the correct extension target key for *this* surface
  const api = useApi<'pos.home.tile.render'>();

  // Singleton subscription shared by all mounts
  const statefulCart = getSharedStatefulCart(api.cart.subscribable);

  /* ---------- React-17 compatible store subscription ---------- */
  const [cart, setCart] = useState(statefulCart.current);

  useEffect(() => {
    const unsubscribe = statefulCart.subscribe(setCart);
    return unsubscribe; // cleanup on unmount
  }, [statefulCart]);

  /* Memo so context value has stable identity unless cart changes */
  const value = useMemo(() => cart, [cart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
