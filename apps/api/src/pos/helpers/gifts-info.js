import { useControlledAloApiFetch } from "./useControlledFetch.js";

export default async function getGiftInfo(tags) {

  console.log("The gifts api request");
  console.time("/loyalty/gifts");
  const GIFTS_END_POINT =
  //TBD
  process.env.GIFTS_ENDPOINT || "https://api.qa.alo.software/v1/loyalty/gifts";

  let data = {
    shopify_customer_tags: tags,
    is_logged_in: true, // this is also needed as part of the api call..
  };
  console.log(data);
  console.log("getGiftInfo GIFTS_END_POINT url:", GIFTS_END_POINT);
  const retVal = useControlledAloApiFetch(GIFTS_END_POINT?.toString(), {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error("Gift api response was not OK");
      }
      return res.json();
    })
    .then((json) => {
      console.log("Sucessfully got the gift response");
      return json.gifts;
    })
    .catch((err) => console.log(err));
  console.timeEnd("/loyalty/gifts");
  return retVal;
}