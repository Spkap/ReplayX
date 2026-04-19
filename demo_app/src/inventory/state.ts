import type { InventoryRecord } from "../types.js";

const inventory = new Map<string, InventoryRecord>();

export const resetInventory = (): void => {
  inventory.clear();
  inventory.set("sku-console-pro", {
    sku: "sku-console-pro",
    available: 1,
    snapshotVersion: 9124
  });
};

export const getInventoryRecord = (sku: string): InventoryRecord => {
  const record = inventory.get(sku);

  if (!record) {
    throw new Error(`Unknown SKU: ${sku}`);
  }

  return record;
};

export const getInventorySnapshot = (sku: string): InventoryRecord => {
  const record = getInventoryRecord(sku);

  return { ...record };
};

resetInventory();
