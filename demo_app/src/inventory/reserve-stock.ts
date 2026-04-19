import { getInventoryRecord, getInventorySnapshot } from "./state.js";

interface ReservationResult {
  reservationToken: string;
  snapshotVersion: number;
  availableAfter: number;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const reserveStock = async (sku: string, quantity: number, requestId: string): Promise<ReservationResult> => {
  const snapshot = getInventorySnapshot(sku);

  if (snapshot.available < quantity) {
    throw new Error(`OutOfStock: ${sku}`);
  }

  // Intentional bug: this delay makes the pre-check stale under concurrent checkout attempts.
  await delay(25);

  const record = getInventoryRecord(sku);
  record.available -= quantity;
  record.snapshotVersion += 1;

  if (record.available < 0) {
    throw new Error(
      `InvariantViolation: inventory.available must never be negative after commit for ${sku}`
    );
  }

  return {
    reservationToken: `res_${requestId}_${snapshot.snapshotVersion}`,
    snapshotVersion: snapshot.snapshotVersion,
    availableAfter: record.available
  };
};
