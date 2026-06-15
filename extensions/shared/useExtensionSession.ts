import { useEffect, useState } from "react";
import { getHostForStore } from "./getHostForStore";
import { getSessionTokenForStore } from "./getSessionTokenForStore";

export function useExtensionSession(api: any) {
  const { currentSession } = api.session;
  const { shopDomain, locationId } = currentSession;

  const [token, setToken] = useState<string>("");
  const [loadings, setLoadings] = useState(true);

  const host = getHostForStore(shopDomain);

  useEffect(() => {
    let mounted = true;

    const loadToken = async () => {
      try {
        const resolvedToken = await getSessionTokenForStore(api, shopDomain);
        if (mounted) {
          setToken(resolvedToken);
        }
      } catch (error) {
        console.error("Failed to get session token:", error);
      } finally {
        if (mounted) {
          setLoadings(false);
        }
      }
    };

    loadToken();

    return () => {
      mounted = false;
    };
  }, [api, shopDomain]);

  return {
    host,
    token,
    shopDomain,
    locationId,
    loadings,
  };
}