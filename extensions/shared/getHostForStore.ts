export function getHostForStore(shopDomain: string) {
  if (
    shopDomain === "alo-dev-store.myshopify.com" ||
    shopDomain.includes("dev") ||
    shopDomain.includes("test") ||
    shopDomain.includes("it-aloyoga")
  ) {
    return "https://alo.pos.shopifyapps.dev.alo.software";
  }

  return "https://alo.pos.shopifyapps.alo.software";
}