import type { CheckoutRequest, CheckoutResult } from "../types.js";
import { reserveStock } from "../inventory/reserve-stock.js";

export const processCheckoutWorker = async (request: CheckoutRequest): Promise<CheckoutResult> => {
  const reservation = await reserveStock(request.sku, request.quantity, request.requestId);

  return {
    orderId: `ord_${request.requestId}`,
    reservationToken: reservation.reservationToken,
    snapshotVersion: reservation.snapshotVersion,
    availableAfter: reservation.availableAfter
  };
};
