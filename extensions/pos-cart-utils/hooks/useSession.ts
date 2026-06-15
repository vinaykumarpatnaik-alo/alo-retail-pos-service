// common/useSession.ts
import {useEffect, useState} from 'react';
import {useApi} from '@shopify/ui-extensions-react/point-of-sale';

export function useSession() {
  const api = useApi();
  const [token, setToken] = useState<string | null>(null);

  /** grab a fresh POS-generated JWT */
  const fetchToken = async () => {
    try {
      const tok = await api.session.getSessionToken();
      setToken(tok ?? null);          // keep the old (string | null) shape
    } catch (err) {
      console.error('[useSession] token fetch failed:', err);
      setToken(null);
    }
  };

  /* first mount ➜ fetch once */
  useEffect(() => { void fetchToken(); }, [api]);

  /* SDK ≥ 2024-10 fires an event when the session token changes
     — hook into it so all extensions instantly get the new token. */
  useEffect(() => {
    // cast to any because the event isn’t typed yet
    const { session } = api as any;

    if (session?.addEventListener) {
      session.addEventListener('sessionTokenChanged', fetchToken);
      return () => session.removeEventListener('sessionTokenChanged', fetchToken);
    }
  }, [api]);

  /* Nothing else changes: return the token and the same setToken
     so legacy code that calls setToken(...) still compiles. */
  return { token, setToken };
}
