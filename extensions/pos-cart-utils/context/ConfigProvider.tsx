import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { getHostForStore } from '../../shared/getHostForStore';
import { getSessionTokenForStore } from '../../shared/getSessionTokenForStore';
import type { ConfigState, FeatureFlags } from '../types/Config';

const DEFAULT_FLAGS: FeatureFlags = {
  showLocalTourist: false,
  showAloAccessOptIn: false,
  showBday: false,
  showMarketingEmails: false,
  metafieldBdayUpdate: false,
  phoneNumberCode: '1',
  showAgeRange: false,
  ageRanges: [],
};

const ConfigContext = createContext<ConfigState>({
  flags: DEFAULT_FLAGS,
  isLoading: true,
  isError: false,
  refreshFlags: async () => {},
});

export const useConfig = (): ConfigState => useContext(ConfigContext);

interface Props {
  readonly children: ReactNode;
  readonly api?: any;
  readonly shopDomain?: string;
}

export function ConfigProvider({ children, api, shopDomain }: Props) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchFlags = useCallback(async (withLoading = false) => {
    if (!api || !shopDomain) {
      setIsLoading(false);
      return;
    }

    if (withLoading) {
      setIsLoading(true);
    }

    try {
      const host = getHostForStore(shopDomain);
      const token = await getSessionTokenForStore(api, shopDomain);

      const response = await fetch(
        `${host}/pos/v1/signup/configs?shop=${encodeURIComponent(shopDomain)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error(`Config API ${response.status}`);

      const data = await response.json();
      const nextFlags = (data?.payload ?? data) as FeatureFlags;

      setFlags(nextFlags);
      setIsError(false);
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [api, shopDomain]);

  useEffect(() => {
    fetchFlags(true);
  }, [fetchFlags]);

  const value = useMemo(
    () => ({
      flags,
      isLoading,
      isError,
      refreshFlags: async () => {
        await fetchFlags(false);
      },
    }),
    [flags, isLoading, isError, fetchFlags]
  );

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

