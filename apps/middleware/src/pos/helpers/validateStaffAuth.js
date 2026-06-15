import getStaff from "./get-staff.js";
import { EmployeeDirectoryStore } from "../datastore/employee-directory-store.js";



function parseStaffAuthConfig(item) {
  if (!item) {
    return { enabled: false, emails: [], domains: [], messages: {} };
  }

  const enabled =
    item.enabled === true ||
    item.enabled?.BOOL === true;


  let emails = [];
  let domains = [];
  let messages = {};

  if (item.value?.S) {
    const parsed = JSON.parse(item.value.S);
    emails = (parsed.emails || []).map(e => e.toLowerCase());
    domains = (parsed.domains || []).map(d => d.toLowerCase());
  }
  if (item.validationMessages?.S) {
    messages = JSON.parse(item.validationMessages.S);
  }

  return { enabled, emails, domains, messages };
}

export async function validateStaffAuth(session, staffId) {
  const employeeDirectory = new EmployeeDirectoryStore({
    region: process.env.AWS_REGION
  });

  // 1 Load config
  const configItem = await employeeDirectory.getConfig("staff_auth_config");
  if (!configItem) {
    throw new Error("STAFF_AUTH_CONFIG_MISSING");
  }

  const { enabled, emails: excludedEmails, domains: allowedDomains, messages } =
    parseStaffAuthConfig(configItem);

  // 2 If disabled → skip checks
  if (!enabled) {
    return {
      status: "ACTIVE",
      reason: "STAFF_AUTH_DISABLED",
      message: messages?.STAFF_AUTH_DISABLED || "Staff auth disabled"
    };
  }

  try {
    // 3 Validate staffId
    if (!staffId) throw new Error("STAFF_INVALID");

    const staff = await getStaff(session, staffId);
    if (!staff?.email) throw new Error("STAFF_INVALID");

    const email = staff.email.toLowerCase();
    const domain = email.split("@")[1];

    const isAllowedDomain = allowedDomains.includes(domain);
    const isExcludedEmail = excludedEmails.includes(email);

    if (!isAllowedDomain) throw new Error("DOMAIN_NOT_ALLOWED");
    if (isExcludedEmail) {
      return {
        status: "ACTIVE",
        reason: "EXCLUDED_EMAIL",
        staff,
        message: messages?.EXCLUDED_EMAIL || "Staff excluded"
      };
    }

    // 4 employee profile validation
    const employee = await employeeDirectory.lookupEmployeeByEmail(email);
    if (!employee) throw new Error("EMPLOYEE_PROFILE_NOT_FOUND");

    const empStatus = employee.status?.S;
    if (empStatus === "TERMINATED" || empStatus === "Terminated") {
      return {
        status: "TERMINATED",
        staff,
        message: messages?.TERMINATED || "You cannot use a terminated employee PIN"
      };
    }

    // 5 Active staff
    return {
      status: "ACTIVE",
      staff,
      message: messages?.ACTIVE || "Staff is active"
    };
  } catch (err) {
    // Map error key to DynamoDB message
    return {
      status: "ERROR",
      staff: null,
      message: messages?.[err.message] || "Invalid staff",
      errorKey: err.message
    };
  }
}
