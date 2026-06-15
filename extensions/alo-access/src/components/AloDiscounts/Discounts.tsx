import React from "react";
import { WelcomeDiscount } from "./WelcomeDiscount";

export const Discounts = ({ customerInfo, cartData }) => {
  // console.log("[DISCOUNT] Discounts component customerInfo ", customerInfo);
  // console.log("[DISCOUNT] Discounts component cartData ", cartData);
  // const api = useExtensionApi();
  // const { customerInfo, cartData } = useContext(SelectionContext);
  const extractEnableFlags = () => {
    let enableWelcomeDiscount = false;
    if (customerInfo?.enableFlags && customerInfo?.enableFlags?.length > 0) {
      for (let i = 0; i < customerInfo?.enableFlags?.length; i++) {
        const gitItem = customerInfo?.enableFlags[i];
        switch (gitItem?.id) {
          case "Discount":
            enableWelcomeDiscount = gitItem?.value;
            break;
          default:
            break;
        }
      }
    }
    return [enableWelcomeDiscount];
  };

  const [enableWelcomeDiscount] = extractEnableFlags();

  //api.toast.show(JSON.stringify(enableWelcomeDiscount),{duration:3000})
  return (
    <>
      {enableWelcomeDiscount && (
        <WelcomeDiscount customerInfo={customerInfo} cartData={cartData} />
      )}
    </>
  );
};

