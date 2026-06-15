import formatPhoneNumber from "./format-phone.js";
import { EmployeeDirectoryStore } from "../datastore/employee-directory-store.js"

import { formatSanitizeInput } from "./sanitize-input.js"
import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";
import { isRetailEmployee } from "./checkRetailEmployee-util.js";

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "" && String(value).trim() !== "null";
}

export default async function employeeData(phone, email, countryCode, session) {
  console.log('Session data from edp', session);
  console.log('phone', phone)
  console.log('email', email)
  const metricName = "emp_lookup";
  const startTime = process.hrtime();
  console.log(`Getting employee data for phone :[${phone}]`);
  let error = null;
  let id;
  let work_email;
  let personal_email;
  let preferred_first_name;
  let preferred_last_name;
  let first_name;
  let last_name;
  let work_phone;
  let work_landline;
  let personal_phone;
  let personal_landline
  let job_title;
  let store;
  let formatted_name;
  let enabled;
  let work_status;
  let staff_email;
  let annual_limit;
  let current_spent;
  let worker_type;
  let retailEmp = false;
  let defaultEmpDiscount = {
    id: "Employee Discount",
    enabled: true,
    discountcode: "",
    type: "",
    value: 0
  };
  let global_annual_limit;
  const currentYear = new Date().getFullYear(); // Get the current year
  let lastUpdatedYear = 2024;
  let lastUpdatedDate = new Date(Date.UTC(2024, 1, 1));
  try {
    const employeeDirectory = new EmployeeDirectoryStore({ region: process.env.AWS_REGION });
    //check the data base for role, use email to lookup staff
    let employee;
    if (phone !== '') {
      employee = await employeeDirectory.lookupEmployeeByPhone(phone, countryCode, session.shop);
    } else if (email !== '') {
      employee = await employeeDirectory.lookupEmployeeByEmail(email);
    }

    if (employee !== null && employee !== 'Employee is eligible for EDP only in his/her home country') {
      id = employee?.id?.S;
      work_email = employee?.work_email?.S;
      personal_email = employee?.personal_email?.S;
      preferred_first_name = employee?.preferred_first_name?.S;
      preferred_last_name = employee?.preferred_last_name?.S;
      first_name = employee?.first_name?.S;
      last_name = employee?.last_name?.S;
      work_phone = employee?.work_phone?.S !== 'null' ? formatPhoneNumber(employee?.work_phone?.S) : "";
      work_landline = employee?.work_landline?.S !== 'null' ? formatPhoneNumber(employee?.work_landline?.S) : "";
      personal_phone = employee?.personal_phone?.S !== 'null' ? formatPhoneNumber(employee?.personal_phone?.S) : "";
      personal_landline = employee?.personal_landline?.S !== 'null' ? formatPhoneNumber(employee?.personal_landline?.S) : "";
      job_title = employee?.job_title?.S
      store = employee?.store?.S;
      enabled = employee?.enabled?.BOOL ?? true;
      work_status = employee?.status?.S;
      worker_type = employee?.worker_type?.S;
      if (employee?.previous_order_date?.S && employee?.previous_order_date?.S !== '') {
        lastUpdatedYear = new Date(employee.previous_order_date.S).getFullYear(); // Extract the year from `last_updated_at`
        lastUpdatedDate = new Date(employee.previous_order_date.S);
        console.log(`last_updated_at year: ${lastUpdatedYear}, current year: ${currentYear}`);
      }
      if (worker_type?.includes('P')) {
        global_annual_limit = await employeeDirectory.globalAnnualSpendLimit('_' + session.shop + '_' + 'P');
        console.log('global_annual_limit parttime', global_annual_limit);
      } else if (worker_type?.includes('F')) {
        global_annual_limit = await employeeDirectory.globalAnnualSpendLimit('_' + session.shop + '_' + 'F');
        console.log('global_annual_limit fultime', global_annual_limit);
      } else if (worker_type?.includes('SL')) {
        global_annual_limit = await employeeDirectory.globalAnnualSpendLimit('_' + session.shop + '_' + 'SL');
        console.log('global_annual_limit seasonal', global_annual_limit);
      } else {
        global_annual_limit = await employeeDirectory.globalAnnualSpendLimit('');
        console.log('global_annual_limit general', global_annual_limit);
      }
      annual_limit = hasValue(employee?.annual_limit?.S) ? employee.annual_limit.S : global_annual_limit;
      current_spent = hasValue(employee?.current_spent?.S) ? employee.current_spent.S : "0";
      console.log('current_spent before year check', current_spent);
      // Update `current_spent` based on the year comparison
      if (currentYear !== lastUpdatedYear) {
        current_spent = "0"; // Reset `current_spent` if years don't match
      }

      if (worker_type === 'SL') {
        const jan1CurrentYear = new Date(Date.UTC(currentYear, 0, 1));
        const jan31CurrentYear = new Date(Date.UTC(currentYear, 0, 31));
        const feb1LastYear = new Date(Date.UTC(currentYear - 1, 1, 1));
        const feb1CurrentYear = new Date(Date.UTC(currentYear, 1, 1));
        const currentDate = new Date();
        const currentDateUTC = new Date(Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth(),
          currentDate.getUTCDate(),
          currentDate.getUTCHours(),
          currentDate.getUTCMinutes(),
          currentDate.getUTCSeconds(),
          currentDate.getUTCMilliseconds()
        ));
        console.log('jan1CurrentYear', jan1CurrentYear);
        console.log('jan31CurrentYear', jan31CurrentYear);
        console.log('feb1LastYear', feb1LastYear);
        console.log('feb1CurrentYear', feb1CurrentYear);
        console.log('currentDate', currentDateUTC);
        console.log('currentDateUTC', currentDateUTC);
        console.log('lastUpdatedDate', lastUpdatedDate);
        if (currentYear !== lastUpdatedYear) {
          current_spent = '0';
          if (lastUpdatedYear == currentYear - 1) {
            if (lastUpdatedDate >= feb1LastYear && lastUpdatedDate < feb1CurrentYear && currentDateUTC < feb1CurrentYear) {
              current_spent = hasValue(employee?.current_spent?.S) ? employee.current_spent.S : "0";
            }
          } else {
            current_spent = "0";
          }
          console.log('non equal year')
        }
        else if (currentYear === lastUpdatedYear) {
          console.log('equal year')
          current_spent = hasValue(employee?.current_spent?.S) ? employee.current_spent.S : "0";
          if (lastUpdatedDate >= jan1CurrentYear && lastUpdatedDate < feb1CurrentYear &&
            currentDateUTC < feb1CurrentYear) {
            current_spent = hasValue(employee?.current_spent?.S) ? employee.current_spent.S : "0";
            console.log('equal year', current_spent);
          } else if (lastUpdatedDate >= jan1CurrentYear && lastUpdatedDate < feb1CurrentYear &&
            currentDateUTC >= feb1CurrentYear) {
            current_spent = "0";
            console.log('equal year1', current_spent);
          }
        }
      }
      console.log(`current_spent after year and SL check for ${id}: ${current_spent}`);
      if (work_status === 'Terminated' || work_status === 'Future') {
        enabled = false;
      }
      // hire_date = employee?.hire_date?.S
      // termination_date = employee?.termination_date?.S
      //we are storing the value as null for indexing
      formatted_name =
        (preferred_first_name !== 'null' ? preferred_first_name : first_name) + " " +
        (preferred_last_name !== 'null' ? preferred_last_name : last_name);

      // console.log("Generate the employee data response");
      // console.log("Attempt to add metafield from employee lookup");
      // addMetafield(session,customerId);
      const discountData = await employeeDirectory.employeeDiscountCode();
      defaultEmpDiscount.discountcode = discountData.discountcode.S
      defaultEmpDiscount.type = discountData.type.S;
      defaultEmpDiscount.value = discountData.value.N;
      console.log("employee discount code");
      console.log("Checking for retail employee for ", id);
      retailEmp = isRetailEmployee(store);
      console.log(defaultEmpDiscount);

    }
    else if (employee === 'Employee is eligible for EDP only in his/her home country') {
      error = "Employee is eligible for EDP only in his/her home country";
    } else {
      error = "No employee record found";
    }
  } catch (e) {
    const errorMessage = e?.message || String(e);
    console.error(
      formatSanitizeInput(`Failed to lookup employee for phone %d...`, phone),
      errorMessage
    );
    error = `Failed to lookup employee for phone ${phone} -> ${errorMessage}`;
  }
  const payload = {
    "employee": {
      "id": id,
      "work_email": work_email,
      "personal_email": personal_email,
      "preferred_name": preferred_first_name + " " + preferred_last_name,
      "formatted_name": formatted_name,
      "first_name": first_name,
      "last_name": last_name,
      "work_phone": work_phone,
      "work_landline": work_landline,
      "personal_phone": personal_phone,
      "personal_landline": personal_landline,
      "job_title": job_title,
      "store": store,
      "enabled": enabled,
      "work_status": work_status,
      "employeeDiscount": defaultEmpDiscount,
      "staff_email": staff_email,
      "worker_type": worker_type,
      "annual_limit": annual_limit,
      "current_spent": current_spent,
      "retail_employee": retailEmp,

    },
    "error": error
  }
  console.log('EDP payload', payload)
  console.log(`Returning employee data for phone ${phone} 
    id ${id} worker status ${work_status} enabled ${enabled} `);
  const endTime = process.hrtime(startTime);
  logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_extensions_employee" });
  return payload;
}
