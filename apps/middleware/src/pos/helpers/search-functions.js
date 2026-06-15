
import {EmployeeDirectoryStore} from "../datastore/employee-directory-store.js"

export async function lookupAssociate(associateId) {
  // replace with the HRIS employee search endpoint when it is available
  const url = `http://api.adp.com/workers/${associateId}`;
  //const response = await axios.get(url);
  return "testing";
}

export async function lookupDynamoData(searchValue) {
    const employeeDirectory = new EmployeeDirectoryStore({ region: process.env.AWS_REGION });
    //check the data base for role, use email to lookup staff
    const data = await employeeDirectory.searchDynamoData(searchValue)
  return data;
}
