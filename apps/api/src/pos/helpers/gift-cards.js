import shopify from "../shopify.js";

const ACTIVATE_GIFT_CARD_MUTATION = `
  mutation giftCardCreate($input: GiftCardCreateInput!) {
    giftCardCreate(input: $input) {
      userErrors {
        field
        message
      }
      giftCard {
        id
        expiresOn
        note
        initialValue {
          amount
        }
        customer {
          id
        }
      }
      giftCardCode
    }
  }
`;

export async function activateGiftCard(session, giftCardData) {
  const time_var = "/graphql/activate/gift-card";
  console.time(time_var);
  console.log("gift card - activate function");
  const client = new shopify.api.clients.Graphql({ session });

  try {
    const graphqlRequestPromise = client.query({
      data: {
        query: ACTIVATE_GIFT_CARD_MUTATION,
        variables: {
          input: {
            initialValue: giftCardData.initialValue,
            customerId: giftCardData.customerId,
            note: giftCardData.note,
            code: giftCardData.code,
          },
        },
      },
    });

    const timeoutValue = process.env.SHOPIFY_API_TIMEOUT;
    const timeout = timeoutValue ? parseInt(timeoutValue, 10) : 10000;
    const response = await Promise.race([
      graphqlRequestPromise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Gift Card Activation request timed out"));
        }, timeout);
      }),
    ]);

    console.log("Query Extension ", response.body.extensions);
    console.timeEnd(time_var);
    return response.body.data.giftCardCreate;

  } catch (error) {
    console.log("error activating gift card", error);
    console.timeEnd(time_var);
    throw error;
  }
}
