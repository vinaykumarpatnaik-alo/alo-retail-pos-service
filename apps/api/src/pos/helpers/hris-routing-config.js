function envNumber(name, defaultValue) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

export function getHrisRoutingConfig() {
  const baseUrl = process.env.HRIS_USER_SYNC_BASE_URL || process.env.ALO_HRIS_USER_SYNC_BASE_URL || "";

  return {
    enabled: Boolean(baseUrl),
    baseUrl,
    token: process.env.HRIS_USER_SYNC_TOKEN || process.env.ALO_HRIS_USER_SYNC_TOKEN || "",
    timeoutMs: envNumber("HRIS_USER_SYNC_TIMEOUT_MS", envNumber("ALO_HRIS_USER_SYNC_TIMEOUT_MS", 5000)),
    idPath: process.env.HRIS_USER_SYNC_ID_PATH || process.env.ALO_HRIS_USER_SYNC_ID_PATH || "/employees/lookup/id",
    emailPath: process.env.HRIS_USER_SYNC_EMAIL_PATH || process.env.ALO_HRIS_USER_SYNC_EMAIL_PATH || "/employees/lookup/email",
    phonePath: process.env.HRIS_USER_SYNC_PHONE_PATH || process.env.ALO_HRIS_USER_SYNC_PHONE_PATH || "/employees/lookup/phone",
  };
}
