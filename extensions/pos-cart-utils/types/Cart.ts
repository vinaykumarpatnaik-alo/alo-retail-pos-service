/* ────────────────────────────────────────────────────────────
   ENUMS / LITERALS THAT APPEAR IN THE API
   ────────────────────────────────────────────────────────────*/

   export type CartDiscountType     = 'Percentage' | 'FixedAmount' | 'Code';
   export type LineItemDiscountType = 'Percentage' | 'FixedAmount';
   
   /* Country / province codes follow Shopify ISO-3166-1 alpha-2 + ISO-3166-2 */
   export type CountryCode   = string; // e.g. "US"
   export type ProvinceCode  = string; // e.g. "CA"
   
   /* ────────────────────────────────────────────────────────────
      SHARED VALUE OBJECTS
      ────────────────────────────────────────────────────────────*/
   
   export interface Discount {
     /** "FixedAmount", "Percentage", "Code" */
     type: CartDiscountType | LineItemDiscountType;
     /** POS label shown to the staff ("Summer Sale") */
     title: string;
     /** Money or percentage, SERIALISED as string */
     value: string;
   }
   
   export interface LineItemDiscount extends Discount {}
   
   export interface Address {
     id?: number;            // returned by the host; not required when adding
     address1?: string;
     address2?: string;
     city?: string;
     company?: string;
     country?: string;
     countryCode?: CountryCode;
     firstName?: string;
     lastName?: string;
     name?: string;
     phone?: string;
     province?: string;
     provinceCode?: ProvinceCode;
     zip?: string;
     /** Whether the POS marks this as "default" (customer context) */
     isDefault?: boolean;
   }
   
   export interface CustomSale {
     title:    string;
     price:    string;   // Shopify always passes money as string
     quantity: number;
     taxable:  boolean;
   }
   
   export interface SetLineItemPropertiesInput {
     lineItemUuid: string;
     properties:   Record<string, string>;
   }
   
   export interface SetLineItemDiscountInput {
     lineItemUuid: string;
     lineItemDiscount: LineItemDiscount;
   }
   
   /* ────────────────────────────────────────────────────────────
      CORE CART SHAPE
      ────────────────────────────────────────────────────────────*/
   
   export interface LineItem {
     uuid:       string;
     variantId:  number;
     price:      string;
     quantity:   number;
     isGiftCard: boolean;
     /** Custom key-value metadata added by your extension */
     properties?: Record<string, string>;
     /** Per-line discounts */
     discounts?: LineItemDiscount[];
     /** Staff attribution (setAttributedStaff…) */
     attributedStaffId?: number;
   }
   
   export interface Customer {
     id:         number;   // Shopify customer ID
     firstName?: string;
     lastName?:  string;
     email?:     string;
     phone?:     string;
     note?:      string;
     /** Default & additional addresses that POS can edit */
     addresses?: Address[];
   }
   
   export interface Cart {
     /* Totals & financials ------------------------------------------------- */
     subtotal:    string;
     taxTotal:    string;
     grandTotal:  string;
   
     /* Discounts ----------------------------------------------------------- */
     cartDiscounts: Discount[];      // All code/auto discounts on the cart
     cartDiscount?: Discount | null; // Sometimes POS exposes a single applied
   
     /* Lines & metadata ---------------------------------------------------- */
     lineItems:  LineItem[];
     properties: Record<string, string>;   // cart-level attributes
     note?:      string;
   
     /* Customer ------------------------------------------------------------ */
     customer?: Customer;
   }
   
   /* ────────────────────────────────────────────────────────────
      OPTIONAL:  helper types if you call the bulk APIs
      ────────────────────────────────────────────────────────────*/
   
   export type SetLineItemPropertiesPayload = SetLineItemPropertiesInput[];
   export type SetLineItemDiscountsPayload  = SetLineItemDiscountInput[];
   