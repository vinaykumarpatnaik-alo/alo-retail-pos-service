import shopify from "../shopify.js";
import DynamoPosAloAccessFeatureConfig from "../datastore/alo-apps-feature.js";

export default async function getGift(session,locale) {
    console.log('Session data',session);
  try {
    const featureConfg = new DynamoPosAloAccessFeatureConfig();
        
    console.log('Store Name',session.shop);
    let response = null;
    if (locale == '' || locale.includes('en')) {
      response = await featureConfg.getFeatureConfig(session.shop);
      console.log('language English', response);
    } else {
      response = await featureConfg.getFeatureConfig(session.shop + '-' + locale);
      console.log('other language', response);
    }
    
    if (response !== null) {
      console.log(
        `Gift With Purchase DB response  ${JSON.stringify(response)}`
      );
    } else {
      console.log(`Gift With Purchase is Null  ${JSON.stringify(response)}`);
    }
    //payload
    const res_payload = {
        gwpvariant:response.variantId,
        gwplimit:response.limit,
        tile_name:response.tile,
        enabled:response.enabled,
        autoApply:response.autoApply,
        id:response.id
    }
    console.log(`Payload  ${JSON.stringify(res_payload)}`);
    
    return res_payload;

  } catch (error) {
    console.error("Error getting shop details", error);
  }
}
