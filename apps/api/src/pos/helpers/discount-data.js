import shopify from "../shopify.js";
import { EmployeeDirectoryStore } from "../datastore/employee-directory-store.js";

export default async function getDiscountData(session) {
    console.log('Session data', session);
    let defaultEmpDiscount = {
        id: "Employee Discount",
        enabled: true,
        discountcode: "",
        type: "",
        value: 0
    };
    try {
        const employeeDirectory = new EmployeeDirectoryStore({ region: process.env.AWS_REGION });

        console.log('Store Name', session.shop);
        const discountValues = await employeeDirectory.getAloDiscounts('_' + session.shop);
        const discountData = await employeeDirectory.employeeDiscountCode();
        defaultEmpDiscount.discountcode = discountData.discountcode.S
        defaultEmpDiscount.type = discountData.type.S;
        defaultEmpDiscount.value = discountData.value.N;
        //payload
        const res_payload = {
            discounts: discountValues,
            retailEmployeeDiscount: defaultEmpDiscount
        }
        console.log(`Payload  ${JSON.stringify(res_payload)}`);

        return res_payload;

    } catch (error) {
        console.error("Error getting shop details", error);
    }
}
