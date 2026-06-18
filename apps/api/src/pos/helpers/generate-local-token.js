import jwt from "jsonwebtoken";

export function encodeLocalAuthToken({ apiKey, apiSecret, storeUrl }) {
  if (!apiKey || !apiSecret || !storeUrl) {
    throw new Error("apiKey, apiSecret, and storeUrl are required");
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const threeHoursInSeconds = 3 * 60 * 60;

  const payload = {
    iss: apiKey,
    aud: apiKey,
    dest: storeUrl,
    iat: nowInSeconds,
    exp: nowInSeconds + threeHoursInSeconds,
  };

  return jwt.sign(payload, apiSecret, {
    algorithm: "HS256",
  });
}