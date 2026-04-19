import { renderOrderSummaryPage } from "../src/routes/order-summary.js";

const fixtureFlagIndex = process.argv.indexOf("--fixture");
const fixture =
  fixtureFlagIndex >= 0 && process.argv[fixtureFlagIndex + 1] === "complete-quote"
    ? "complete-quote"
    : "missing-taxes";

try {
  const html = renderOrderSummaryPage(fixture);
  console.log(JSON.stringify({ ok: true, fixture, htmlLength: html.length }, null, 2));
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : "UnknownError";
  console.error(JSON.stringify({ ok: false, fixture, error: message }, null, 2));
  process.exit(1);
}
