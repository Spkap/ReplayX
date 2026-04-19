import type { OrderSummary, ShippingQuote } from "../types.js";

export const buildSummaryTotals = (quote: ShippingQuote): OrderSummary => {
  // Intentional bug: `taxes` may be null in the missing-taxes fixture, which triggers the seeded incident.
  const taxes = quote.taxes!.reduce((total, line) => total + line.amount, 0);

  return {
    quoteId: quote.quoteId,
    subtotal: quote.subtotal,
    shipping: quote.shipping,
    taxes,
    grandTotal: quote.subtotal + quote.shipping + taxes
  };
};
