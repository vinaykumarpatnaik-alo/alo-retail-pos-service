  import formatPhoneNumber from "./format-phone.js";
  import {EmployeeDirectoryStore} from "../datastore/employee-directory-store.js"
  import getStaff from "./get-staff.js"
  import {formatSanitizeInput} from './sanitize-input.js'
  import { logMetric, hrtimeToMilliseconds } from "./metric-util.js";

  export default async function userData(session, staffId) {
    console.log(`Getting user data for staff :[${staffId}]`);
    const metricName = "user_data";
    const startTime = process.hrtime();
    let id;
    let email;
    let first_name;
    let last_name;
    let phone;
    let is_customer_pos_user;
    let customer_email;
    let customer_phone;
    let userData;
    let error;
    let permission_enabled = false;
    let role;
  
    try{
      userData = await getStaff(session,staffId);

      id =  staffId;
      email = userData?.email?.toLowerCase();
      first_name = userData?.firstName;
      last_name = userData?.lastName;
      phone = userData?.phone ? formatPhoneNumber(userData.phone) : "";
      is_customer_pos_user = false;

      if (email === undefined) {
        error = "Staff Id is mandatory. Please reach out to manager";
        throw new Error('Staff Id is mandatory to find email, Email is undefined');
      }
      
      const regex = /^[A-Za-z0-9._%+-]+@aloyoga\.[A-Za-z]{2,}$/;

      if (regex.test(email)) {
        console.log(`${email} is valid.`);
        const employeeDirectory = new EmployeeDirectoryStore({ region: process.env.AWS_REGION });
        //check the data base for role, use email to lookup staff
        const staff = await employeeDirectory.lookupEmployeeByEmail(email);
        if(staff !== null){
          role = staff.job_title.S;
          permission_enabled = await employeeDirectory.isPermitted(role);
          console.log(`Permission for staff id ${staffId} is ${permission_enabled}`);
        }else{
          error = email+" is not found. Please review your email address in your employee profile";
          role = "Default"
          throw new Error(error);
        }
      } else {
        console.log(`${email} is not valid.`);
        error = email+" is not a valid work email. Please request your Manager to correct it in your staff profile";
        throw new Error(error);
      }
    }catch(e){
      console.error(formatSanitizeInput(`Failed to load the staff id %s...`, staffId), e);
    }

    const payload = {
      "user": {
          "id": id,
          "email": email,
          "first_name": first_name,
          "last_name": last_name,
          "staff_phone": phone,
          "role": role,
          "permission_enabled": permission_enabled,
          "is_customer_pos_user": is_customer_pos_user,
          "customer_phone": customer_phone,
          "customer_email": customer_email
  
      },
      "error": error
    }
    console.log(`Returning user data for staff id ${staffId} with role ${role} and email ${email}`);
    const endTime = process.hrtime(startTime);
    logMetric(metricName, hrtimeToMilliseconds(endTime), { APIName: "api_extensions_data" });
    return payload;
  }
  
      
