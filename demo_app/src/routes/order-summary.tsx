import { buildSummaryTotals } from "../orders/build-summary.js";
import { loadQuoteFixture } from "../orders/quote-adapter.js";

export const renderOrderSummaryPage = (fixture: "complete-quote" | "missing-taxes"): string => {
  const summary = buildSummaryTotals(loadQuoteFixture(fixture));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ReplayX Demo Order Summary</title>
  </head>
  <body>
    <h1>Order summary</h1>
    <dl>
      <dt>Quote ID</dt><dd>${summary.quoteId}</dd>
      <dt>Subtotal</dt><dd>${summary.subtotal}</dd>
      <dt>Shipping</dt><dd>${summary.shipping}</dd>
      <dt>Taxes</dt><dd>${summary.taxes}</dd>
      <dt>Grand Total</dt><dd>${summary.grandTotal}</dd>
    </dl>
  </body>
</html>`;
};
