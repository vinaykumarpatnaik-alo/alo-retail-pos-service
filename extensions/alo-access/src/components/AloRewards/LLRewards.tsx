import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useLocaleSubscription } from '@shopify/ui-extensions-react/point-of-sale';
import { RewardImages } from './RewardImages';
import { SelectionContext } from '../context/SelectionContext';
import ENjsonData from '../../../locales/en.json';
import FRcajsonData from '../../../locales/fr-ca.json';

export const LLRewards = React.memo(() => {
  const { customerInfo, cartData, tierState } = useContext(SelectionContext);
  const locale = useLocaleSubscription();

  /* ——————————————————————————————— i18n —————————————————————————————— */
  const [messages, setMessages] = useState(() => ENjsonData.main); // default

  useEffect(() => {
    // locale rarely changes; keep effect minimal
    setMessages(locale.includes('fr-CA') ? FRcajsonData.main : ENjsonData.main);
  }, [locale]);

  /* ————————————————————— derived, memoised values —————————————————— */
  const sortedRewards = useMemo(() => {
    // create *copy* so original context object is never mutated
    if (!customerInfo?.llRewards) return [];
    return [...customerInfo.llRewards].sort(
      (a, b) => a.point_cost - b.point_cost || a.title.localeCompare(b.title),
    );
  }, [customerInfo?.llRewards]);

  const enableRewards = useMemo(() => {
    const flags = customerInfo?.enableFlags ?? [];
    return flags.some((f) => f.id === 'Loyalty Reward' && f.value === true);
  }, [customerInfo?.enableFlags]);

  const latestPoints = tierState?.pointsBalance?.tierFieldValue ?? 0;

  /* ——————————————————————————— render ——————————————————————————— */
  if (!enableRewards) return null;

  return (
    <RewardImages
      imagesArr={sortedRewards}
      rewardType="Loyalty Reward"
      latestPoints={latestPoints}
      messages={messages}
    />
  );
});
