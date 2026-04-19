import type { ShippingQuote } from "../types.js";

export const loadQuoteFixture = (fixture: "complete-quote" | "missing-taxes"): ShippingQuote => {
  if (fixture === "missing-taxes") {
    return {
      quoteId: "quote_554",
      subtotal: 149,
      shipping: 0,
      taxes: null
    };
  }

  return {
    quoteId: "quote_118",
    subtotal: 149,
    shipping: 12,
    taxes: [
      { label: "state", amount: 9 },
      { label: "county", amount: 2 }
    ]
  };
};
