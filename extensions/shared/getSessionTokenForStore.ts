import { LOCAL_SIGNUP_CONFIG } from "./localTokenConfig";

export async function getSessionTokenForStore(api: any, shopDomain: string) {
  if (shopDomain === LOCAL_SIGNUP_CONFIG.storeDomain) {
    const response = await fetch(LOCAL_SIGNUP_CONFIG.localTokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: LOCAL_SIGNUP_CONFIG.apiKey,
        apiSecret: LOCAL_SIGNUP_CONFIG.apiSecret,
        storeUrl: LOCAL_SIGNUP_CONFIG.storeUrl,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch local token");
    }

    const result = await response.json();
    return result.token;
  }

  return await api.session.getSessionToken();
}