
import DynamoPosAloAccessFeatureConfig from "../datastore/alo-apps-feature.js";

export default async function featureStatus(session, featureName) {
    console.log(`Getting feature status for  :[${featureName}]`);
    let error = null;
    let feature;
    let enabled;
    
    try {
      if(!featureName || featureName === undefined){
        console.log("No feature name in the request");
        return null;
      }
      const featureConfg = new DynamoPosAloAccessFeatureConfig();
      let response;

      // Determine the feature key to use for the database lookup
      let featureKey = session.shop;
      if (featureName === 'isPhoneRequired') {
          featureKey += "-phone";
      } else if (featureName === 'gwp') {
          featureKey += "-gwp";
      }

      response = await featureConfg.getFeatureConfig(featureKey);

      if (response === null) {
        console.error(`Feature [${featureName}] is Null`);
        return null;
      }

      console.log(`Feature [${featureName}] DB response: ${JSON.stringify(response)}`);


      // Based on your feature, construct the payload
      let payload;
      if (featureName === 'isPhoneRequired') {
          payload = {
              isPhoneRequired: response.enabled,
              id: response.id
          };
      } else if (featureName === 'gwp') {
          payload = {
              gwpVariant: response.variantId,
              gwpLimit: response.limit,
              tileName: response.tile,
              enabled: response.enabled,
              id: response.id
          };
      }
      console.log(`Payload  ${JSON.stringify(res_payload)}`);
      return res_payload;
  
    } catch (error) {
      console.error("Error getting feature status", error);
      return null;
    }
  }
  
      