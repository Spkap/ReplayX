import { processCheckoutWorker } from "../queue/checkout-worker.js";
import { resetInventory } from "../inventory/state.js";
import type { CheckoutRequest, CheckoutResult } from "../types.js";

export const runCheckoutRaceScenario = async (mode: "concurrent" | "serial"): Promise<CheckoutResult[]> => {
  resetInventory();

  const requests: CheckoutRequest[] = [
    { sku: "sku-console-pro", quantity: 1, requestId: "8021" },
    { sku: "sku-console-pro", quantity: 1, requestId: "8022" }
  ];

  if (mode === "serial") {
    return [await processCheckoutWorker(requests[0])];
  }

  return Promise.all(requests.map((request) => processCheckoutWorker(request)));
};
