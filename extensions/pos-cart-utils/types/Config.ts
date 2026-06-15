export interface FeatureFlags {
  showLocalTourist: boolean;
  showAloAccessOptIn: boolean;
  showBday?: boolean;
  showMarketingEmails?: boolean;
  metafieldBdayUpdate?: boolean;
  phoneNumberCode?: string;
  showAgeRange?: boolean;
  ageRanges?: string[];
  [key: string]: boolean | string | number | string[] | undefined;
}

export interface ConfigState {
  flags: FeatureFlags;
  isLoading: boolean;
  isError: boolean;
  refreshFlags: () => Promise<void>;
}
