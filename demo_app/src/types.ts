export interface InventoryRecord {
  sku: string;
  available: number;
  snapshotVersion: number;
}

export interface CheckoutRequest {
  sku: string;
  quantity: number;
  requestId: string;
}

export interface CheckoutResult {
  orderId: string;
  reservationToken: string;
  snapshotVersion: number;
  availableAfter: number;
}

export interface AccessToken {
  value: string;
  fingerprint: string;
  expiresAt: number;
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  lastActiveAt: number;
  accessToken: AccessToken;
}

export interface TaxLine {
  label: string;
  amount: number;
}

export interface ShippingQuote {
  quoteId: string;
  subtotal: number;
  shipping: number;
  taxes: TaxLine[] | null;
}

export interface OrderSummary {
  quoteId: string;
  subtotal: number;
  shipping: number;
  taxes: number;
  grandTotal: number;
}
