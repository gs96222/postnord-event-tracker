export enum ShipmentStatus {
  CREATED = 'created',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  ATTEMPTED_DELIVERY = 'attempted_delivery',
  EXCEPTION = 'exception',
  RETURNED = 'returned',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export const VALID_SHIPMENT_STATUSES = Object.values(ShipmentStatus);

export const SHIPMENT_STATUS_DESCRIPTIONS: Record<ShipmentStatus, string> = {
  [ShipmentStatus.CREATED]: 'Shipment has been created and registered in the system',
  [ShipmentStatus.PICKED_UP]: 'Package has been picked up from sender',
  [ShipmentStatus.IN_TRANSIT]: 'Package is in transit between facilities',
  [ShipmentStatus.OUT_FOR_DELIVERY]: 'Package is out for delivery to recipient',
  [ShipmentStatus.DELIVERED]: 'Package has been successfully delivered',
  [ShipmentStatus.ATTEMPTED_DELIVERY]: 'Delivery was attempted but unsuccessful',
  [ShipmentStatus.EXCEPTION]: 'An exception occurred during processing',
  [ShipmentStatus.RETURNED]: 'Package is being returned to sender',
  [ShipmentStatus.CANCELLED]: 'Shipment has been cancelled',
  [ShipmentStatus.ON_HOLD]: 'Shipment is temporarily on hold',
};

export const VALIDATION_LIMITS = {
  SHIPMENT_ID: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
  },
  LOCATION: {
    MAX_LENGTH: 200,
  },
  DETAILS: {
    MAX_LENGTH: 500,
  },
  QUERY_LIMIT: {
    MIN: 1,
    MAX: 100,
    DEFAULT: 50,
  },
} as const;

export const SHIPMENT_ID_PATTERNS = [
  /^[A-Z]{2}\d{9}[A-Z]{2}$/, // Universal Postal Union standard: XX123456789XX
  /^SHIP-\d{6,12}$/, // Alternative format: SHIP-123456
  /^[A-Z0-9-_]{5,50}$/i, // Generic alphanumeric with separators
] as const;
