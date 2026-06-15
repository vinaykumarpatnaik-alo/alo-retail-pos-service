import React, { useEffect } from 'react';
import {
  Navigator,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale';

import HomePage from './components/HomePage';
import { AddBirthday } from './components/addBirthday';
import { AddCountryCity } from './components/addCountryCity';
import { ConfigProvider } from '../../pos-cart-utils/context/ConfigProvider';
import { getHostForStore } from '../../shared/getHostForStore';

const SmartGridModal = ({ Host }: { Host: string }) => {
  return (
    <Navigator>
      <HomePage Host={Host} />
      <AddBirthday />
      <AddCountryCity />
    </Navigator>
  );
};


function ModalWrapper() {
  const api = useApi();
  const { currentSession } = api.session;
  const { shopDomain } = currentSession;
  const host = getHostForStore(shopDomain);

  return (
    <ConfigProvider api={api} shopDomain={shopDomain}>
     <SmartGridModal Host={host} />
    </ConfigProvider>
  );
}

export default reactExtension('pos.home.modal.render', () => <ModalWrapper />);

