import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { handler } from '../../api/recordEvent';
import { createEvent, shippmentEventExist } from '../../services';
import { SHIPMENT_STATUS_DESCRIPTIONS, ShipmentEvent, ShipmentStatus } from '../../models';
import { mockAPIGatewayEvent, mockContext } from '../../../mocks';

jest.mock('../../services');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-event-id-123'),
}));

const mockCreateEvent = createEvent as jest.MockedFunction<typeof createEvent>;
const mockShippmentEventExist = shippmentEventExist as jest.MockedFunction<
  typeof shippmentEventExist
>;

const FIXED_DATE = '2025-05-26T20:17:31.464Z';
const mockDate = new Date(FIXED_DATE);

const dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
Date.now = jest.fn(() => mockDate.getTime());

const FIXED_TIMESTAMP = new Date(FIXED_DATE).toISOString();

const mockEvent: APIGatewayProxyEvent = {
  ...mockAPIGatewayEvent,
  body: JSON.stringify({
    timestamp: FIXED_TIMESTAMP,
    status: ShipmentStatus.PICKED_UP,
    location: 'Stockholm, Sweden',
    details: 'Package picked up from sender',
  }),
  path: '/shipments/SHIP-123456/events',
};

const mockCreateEventRequest = {
  timestamp: FIXED_TIMESTAMP,
  status: ShipmentStatus.PICKED_UP,
  location: 'Stockholm, Sweden',
  details: 'Package picked up from sender',
};

describe('recordEvent handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Success Cases', () => {
    beforeEach(() => {
      mockShippmentEventExist.mockResolvedValue({ exists: false });
      mockCreateEvent.mockResolvedValue({} as ShipmentEvent);
    });

    it('should create a new event successfully', async () => {
      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.CREATED);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Event created successfully');
      expect(body.data).toMatchObject({
        id: 'test-event-id-123',
        shipmentId: 'SHIP-123456',
        status: ShipmentStatus.PICKED_UP,
        location: 'Stockholm, Sweden',
        details: 'Package picked up from sender',
      });

      expect(mockShippmentEventExist).toHaveBeenCalledWith(
        'SHIP-123456',
        ShipmentStatus.PICKED_UP,
        FIXED_TIMESTAMP
      );
      expect(mockCreateEvent).toHaveBeenCalledWith(
        'SHIP-123456',
        expect.objectContaining({
          id: 'test-event-id-123',
          shipmentId: 'SHIP-123456',
          status: ShipmentStatus.PICKED_UP,
          location: 'Stockholm, Sweden',
          details: 'Package picked up from sender',
        })
      );
    });

    it('should use default description when details not provided', async () => {
      const requestWithoutDetails = {
        timestamp: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
        status: ShipmentStatus.DELIVERED,
        location: 'Stockholm, Sweden',
      };

      const eventWithoutDetails = {
        ...mockEvent,
        body: JSON.stringify(requestWithoutDetails),
      };

      const result = await handler(eventWithoutDetails, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.CREATED);

      const body = JSON.parse(result.body);
      expect(body.data.status).toBe(ShipmentStatus.DELIVERED);
      // Should use default description from SHIPMENT_STATUS_DESCRIPTIONS
      expect(body.data.details).toBe(SHIPMENT_STATUS_DESCRIPTIONS[ShipmentStatus.DELIVERED]);
    });

    it('should handle different shipment statuses', async () => {
      const statuses = [
        ShipmentStatus.CREATED,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.DELIVERED,
      ];

      for (const status of statuses) {
        const requestWithStatus = {
          ...mockCreateEventRequest,
          status,
        };

        const eventWithStatus = {
          ...mockEvent,
          body: JSON.stringify(requestWithStatus),
        };

        const result = await handler(eventWithStatus, mockContext, jest.fn())!;

        expect(result.statusCode).toBe(StatusCodes.CREATED);

        const body = JSON.parse(result.body);
        expect(body.data.status).toBe(status);
      }
    });

    it('should generate createdAt timestamp', async () => {
      mockShippmentEventExist.mockResolvedValue({ exists: false });
      mockCreateEvent.mockResolvedValue({} as ShipmentEvent);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.CREATED);

      expect(mockCreateEvent).toHaveBeenCalledWith(
        'SHIP-123456',
        expect.objectContaining({
          createdAt: expect.any(String),
        })
      );
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for invalid shipment ID', async () => {
      const eventWithInvalidShipmentId = {
        ...mockEvent,
        pathParameters: { shipmentId: '' },
      };

      const result = await handler(eventWithInvalidShipmentId, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for missing request body', async () => {
      const eventWithoutBody = {
        ...mockEvent,
        body: null,
      };

      const result = await handler(eventWithoutBody, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Request body is required');
    });

    it('should return 400 for invalid JSON', async () => {
      const eventWithInvalidJSON = {
        ...mockEvent,
        body: 'invalid json',
      };

      const result = await handler(eventWithInvalidJSON, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid JSON in request body');
    });

    it('should return 400 for invalid status', async () => {
      const invalidRequest = {
        ...mockCreateEventRequest,
        status: 'INVALID_STATUS',
      };

      const eventWithInvalidStatus = {
        ...mockEvent,
        body: JSON.stringify(invalidRequest),
      };

      const result = await handler(eventWithInvalidStatus, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteRequest = {
        timestamp: new Date(Date.now() - 60000).toISOString(),
        // missing status
        location: 'Stockholm, Sweden',
      };

      const eventWithIncompleteRequest = {
        ...mockEvent,
        body: JSON.stringify(incompleteRequest),
      };

      const result = await handler(eventWithIncompleteRequest, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for future timestamp', async () => {
      dateSpy.mockRestore();
      const futureTimestamp = '2030-01-01T00:00:00.000Z';
      const futureRequest = {
        ...mockCreateEventRequest,
        timestamp: futureTimestamp,
      };

      const eventWithFutureTimestamp = {
        ...mockEvent,
        body: JSON.stringify(futureRequest),
      };

      const result = await handler(eventWithFutureTimestamp, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Event timestamp cannot be in the future');
    });

    it('should return 400 for invalid timestamp format', async () => {
      const invalidRequest = {
        ...mockCreateEventRequest,
        timestamp: 'invalid-timestamp',
      };

      const eventWithInvalidTimestamp = {
        ...mockEvent,
        body: JSON.stringify(invalidRequest),
      };

      const result = await handler(eventWithInvalidTimestamp, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });
  });

  describe('Conflict Cases', () => {
    it('should return 409 for duplicate event', async () => {
      mockShippmentEventExist.mockResolvedValue({ exists: true });

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.CONFLICT);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Event with this shipment ID, status and timestamp already exists');

      expect(mockCreateEvent).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockShippmentEventExist.mockResolvedValue({ exists: false });
    });

    it('should handle general service errors gracefully', async () => {
      mockCreateEvent.mockRejectedValue(new Error('Service Error'));

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error occurred while creating event');
    });

    it('should handle ConditionalCheckFailedException', async () => {
      const conditionalError = new Error('ConditionalCheckFailedException');
      conditionalError.name = 'ConditionalCheckFailedException';
      mockCreateEvent.mockRejectedValue(conditionalError);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.CONFLICT);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Event with this ID already exists');
    });

    it('should handle ValidationException', async () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationException';
      mockCreateEvent.mockRejectedValue(validationError);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid data format');
    });

    it('should handle non-Error exceptions', async () => {
      mockCreateEvent.mockRejectedValue('String error');

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error occurred while creating event');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty path parameters', async () => {
      const eventWithEmptyParams = {
        ...mockEvent,
        pathParameters: {},
      };

      const result = await handler(eventWithEmptyParams, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should handle null path parameters', async () => {
      const eventWithNullParams = {
        ...mockEvent,
        pathParameters: null,
      };

      const result = await handler(eventWithNullParams, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });
  });
});
