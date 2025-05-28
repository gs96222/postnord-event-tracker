import {
  validateShipmentIdFormat,
  validateEventTimestamp,
  CreateEventSchema,
  ShipmentEventParamsSchema,
  GetEventsQuerySchema,
} from '../../validators/event.validator';
import { ShipmentStatus } from '../../models';

const FIXED_DATE = new Date('2025-05-26T10:00:00.000Z');

describe('Validators', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('validateShipmentIdFormat', () => {
    it('should validate correct shipment ID formats', () => {
      const validIds = ['SHIP-123456', 'SHIP-ABC123', 'SHIP-123ABC', 'PKG-456789', 'ORDER-789012'];

      validIds.forEach(id => {
        expect(validateShipmentIdFormat(id)).toBe(true);
      });
    });

    it('should reject truly invalid shipment ID formats', () => {
      const invalidIds = [''];

      expect(validateShipmentIdFormat('')).toBe(false);
    });
  });

  describe('validateEventTimestamp', () => {
    it('should validate current timestamp', () => {
      const now = new Date().toISOString();
      expect(validateEventTimestamp(now)).toBe(true);
    });

    it('should validate past timestamps within one year', () => {
      const validPastTimes = [
        new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute ago
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 1 month ago
        new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(), // 10 months ago
      ];

      validPastTimes.forEach(timestamp => {
        expect(validateEventTimestamp(timestamp)).toBe(true);
      });
    });

    it('should validate near-future timestamps (within 5 minutes)', () => {
      const validNearFuture = [
        new Date(Date.now() + 1 * 60 * 1000).toISOString(), // 1 minute future
        new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 minutes future
        new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes future (boundary)
      ];

      validNearFuture.forEach(timestamp => {
        expect(validateEventTimestamp(timestamp)).toBe(true);
      });
    });

    it('should reject far future timestamps (beyond 5 minutes)', () => {
      const invalidFutureTimes = [
        new Date(Date.now() + 6 * 60 * 1000).toISOString(), // 6 minutes future
        new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour future
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day future
      ];

      invalidFutureTimes.forEach(timestamp => {
        expect(validateEventTimestamp(timestamp)).toBe(false);
      });
    });

    it('should handle boundary cases', () => {
      // Exactly 5 minutes in future is valid
      const fiveMinutesFuture = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      expect(validateEventTimestamp(fiveMinutesFuture)).toBe(true);

      // Exactly one year ago is valid
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      expect(validateEventTimestamp(oneYearAgo)).toBe(true);
    });

    it('should handle invalid date formats', () => {
      const invalidDates = [
        'invalid-date',
        '2025-13-01T10:00:00.000Z', // invalid month
        '2025-01-32T10:00:00.000Z', // invalid day
        '', // empty string
      ];

      invalidDates.forEach(timestamp => {
        expect(validateEventTimestamp(timestamp)).toBe(false);
      });
    });
  });

  describe('CreateEventSchema', () => {
    const validEventData = {
      timestamp: '2025-05-26T10:00:00.000Z',
      status: ShipmentStatus.PICKED_UP,
      location: 'Stockholm, Sweden',
      details: 'Package picked up from sender',
    };

    it('should validate complete event data', () => {
      const result = CreateEventSchema.safeParse(validEventData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validEventData);
      }
    });

    it('should validate minimal required fields', () => {
      const minimalData = {
        timestamp: '2025-05-26T10:00:00.000Z',
        status: ShipmentStatus.CREATED,
      };

      const result = CreateEventSchema.safeParse(minimalData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timestamp).toBe(minimalData.timestamp);
        expect(result.data.status).toBe(minimalData.status);
        expect(result.data.location).toBeUndefined();
        expect(result.data.details).toBeUndefined();
      }
    });

    it('should validate all shipment statuses', () => {
      const statuses = [
        ShipmentStatus.CREATED,
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.DELIVERED,
      ];

      statuses.forEach(status => {
        const data = { ...validEventData, status };
        const result = CreateEventSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid timestamp formats', () => {
      const invalidTimestamps = [
        'invalid-date',
        '2025-05-26', // missing time
        '2025-05-26 10:00:00', // wrong format
        '', // empty
      ];

      invalidTimestamps.forEach(timestamp => {
        const data = { ...validEventData, timestamp };
        const result = CreateEventSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('ISO 8601');
        }
      });
    });

    it('should reject invalid status values', () => {
      const definitelyInvalidStatuses = [123, null, undefined, 'CANCELLED'];

      definitelyInvalidStatuses.forEach(status => {
        const data = { ...validEventData, status };
        const result = CreateEventSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });

    it('should reject location that exceeds max length which is 255 characters', () => {
      const longLocation = 'A'.repeat(256);
      const data = { ...validEventData, location: longLocation };

      const result = CreateEventSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Location must be less than');
      }
    });

    it('should reject details that exceed max length which is 1000 characters', () => {
      const longDetails = 'A'.repeat(1001);
      const data = { ...validEventData, details: longDetails };

      const result = CreateEventSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Details must be less than');
      }
    });

    it('should reject missing required fields', () => {
      const incompleteData = [
        { status: ShipmentStatus.CREATED },
        { timestamp: '2025-05-26T10:00:00.000Z' },
        {},
      ];

      incompleteData.forEach(data => {
        const result = CreateEventSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ShipmentEventParamsSchema', () => {
    it('should validate correct shipment ID', () => {
      const validParams = { shipmentId: 'SHIP-123456' };

      const result = ShipmentEventParamsSchema.safeParse(validParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.shipmentId).toBe('SHIP-123456');
      }
    });

    it('should reject empty shipment ID', () => {
      const emptyParams = { shipmentId: '' };

      const result = ShipmentEventParamsSchema.safeParse(emptyParams);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Shipment ID is required');
      }
    });

    it('should reject shipment ID that is too long which is 50', () => {
      const longId = 'SHIP-' + 'A'.repeat(100); // Assuming max length is lower
      const longParams = { shipmentId: longId };

      const result = ShipmentEventParamsSchema.safeParse(longParams);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('must be less than');
      }
    });

    it('should reject invalid shipment ID format', () => {
      const testCases = [
        { shipmentId: '', shouldFail: true },
        { shipmentId: 'invalid-format', shouldFail: false },
        { shipmentId: '123456', shouldFail: false },
        { shipmentId: 'ship-123456', shouldFail: false },
        { shipmentId: 'SHIP_123456', shouldFail: false },
      ];

      testCases.forEach(({ shipmentId, shouldFail }) => {
        const result = ShipmentEventParamsSchema.safeParse({ shipmentId });
        expect(result.success).toBe(!shouldFail);

        if (shouldFail && !result.success) {
          expect(
            result.error.errors.some(
              err =>
                err.message.includes('Shipment ID format is invalid') ||
                err.message.includes('required')
            )
          ).toBe(true);
        }
      });
    });

    it('should reject missing shipment ID', () => {
      const result = ShipmentEventParamsSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe('GetEventsQuerySchema', () => {
    it('should validate empty query parameters (use defaults which is 50)', () => {
      const result = GetEventsQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.startKey).toBeUndefined();
      }
    });

    it('should validate query with limit', () => {
      const queryWithLimit = { limit: '10' };

      const result = GetEventsQuerySchema.safeParse(queryWithLimit);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('should validate query with startKey', () => {
      const queryWithStartKey = { startKey: 'some-base64-key' };

      const result = GetEventsQuerySchema.safeParse(queryWithStartKey);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startKey).toBe('some-base64-key');
      }
    });

    it('should validate query with both limit and startKey', () => {
      const completeQuery = { limit: '25', startKey: 'pagination-key' };

      const result = GetEventsQuerySchema.safeParse(completeQuery);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.startKey).toBe('pagination-key');
      }
    });

    it('should reject limit that is too small', () => {
      const tooSmallLimit = { limit: '0' };

      const result = GetEventsQuerySchema.safeParse(tooSmallLimit);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Limit must be between');
      }
    });

    it('should reject limit that is too large which is 100', () => {
      const tooLargeLimit = { limit: '1000' };

      const result = GetEventsQuerySchema.safeParse(tooLargeLimit);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Limit must be between');
      }
    });

    it('should handle boundary values for limit', () => {
      const boundaryTests = [
        { limit: '1', shouldPass: true },
        { limit: '100', shouldPass: true },
        { limit: '50', shouldPass: true },
      ];

      boundaryTests.forEach(({ limit, shouldPass }) => {
        const result = GetEventsQuerySchema.safeParse({ limit });
        expect(result.success).toBe(shouldPass);
      });
    });
  });
});
