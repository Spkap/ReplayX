import { runCheckoutRaceScenario } from "../src/checkout/submit-order.js";

const mode = process.argv.includes("--serial") ? "serial" : "concurrent";

try {
  const orders = await runCheckoutRaceScenario(mode);
  console.log(JSON.stringify({ ok: true, mode, orders }, null, 2));
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : "UnknownError";
  console.error(JSON.stringify({ ok: false, mode, error: message }, null, 2));
  process.exit(1);
}
