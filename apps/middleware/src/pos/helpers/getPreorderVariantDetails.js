// services/getPreorderVariantDetails.ts
import shopify from "../shopify.js";

function asVariantGid(idOrGid) {
  const s = String(idOrGid);
  return s.startsWith("gid://") ? s : `gid://shopify/ProductVariant/${s}`;
}

const QUERY_DIRECT = `
  query VariantWithPreorder($variantId: ID!, $ns: String = "preorder") {
    productVariant(id: $variantId) {
      id
      sku
      title
      variantPreorder: metafields(first: 250, namespace: $ns) {
        edges { node { namespace key type value updatedAt } }
      }
      product {
        id
        title
        tags
        productPreorder: metafields(first: 50, namespace: $ns) {
          edges { node { namespace key type value updatedAt } }
        }
      }
    }
  }
`;

const QUERY_SEARCH = `
  query ProductsWithPreorderVariant($q: String!, $ns: String = "preorder") {
    products(first: 5, query: $q) {
      edges {
        node {
          id
          title
          tags
          productPreorder: metafields(first: 50, namespace: $ns) {
            edges { node { namespace key type value updatedAt } }
          }
          variants(first: 100) {
            edges {
              node {
                id
                sku
                title
                variantPreorder: metafields(first: 250, namespace: $ns) {
                  edges { node { namespace key type value updatedAt } }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export default async function getPreorderVariantDetails(
  session,
  variantIdOrGid,
  { namespace = "preorder", useSearch = false } = {}
) {
  const client = new shopify.api.clients.Graphql({ session });

  if (!useSearch) {
    const variables = { variantId: asVariantGid(variantIdOrGid), ns: namespace };
    const { body } = await client.query({ data: { query: QUERY_DIRECT, variables } });
    // SDK returns { body: { data, extensions? } }
    return body?.data?.productVariant ?? null;
  }

  // Search mode
  const numeric = String(variantIdOrGid).split("/").pop();
  const q = `tag:preorder AND variant_id:${numeric}`;
  const { body } = await client.query({
    data: { query: QUERY_SEARCH, variables: { q, ns: namespace } },
  });

  const products = body?.data?.products?.edges ?? [];
  for (const { node: product } of products) {
    for (const { node: variant } of (product?.variants?.edges ?? [])) {
      if (String(variant?.id).endsWith(`/${numeric}`)) {
        return { product, variant };
      }
    }
  }
  return null;
}
