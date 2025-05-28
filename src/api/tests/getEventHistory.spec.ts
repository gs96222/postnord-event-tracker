import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { handler } from '../../api/getEventHistory';
import { getEventHistory } from '../../services';
import { ShipmentStatus } from '../../models';
import { mockAPIGatewayEvent, mockContext } from '../../../mocks';

jest.mock('../../services');

const mockGetEventHistory = getEventHistory as jest.MockedFunction<typeof getEventHistory>;

const mockEvents = [
  {
    id: 'event-1',
    shipmentId: 'SHIP-123456',
    timestamp: '2025-05-26T10:00:00.000Z',
    status: ShipmentStatus.CREATED,
    location: 'Stockholm, Sweden',
    details: 'Shipment created',
    createdAt: '2025-05-26T10:00:00.000Z',
  },
  {
    id: 'event-2',
    shipmentId: 'SHIP-123456',
    timestamp: '2025-05-26T11:00:00.000Z',
    status: ShipmentStatus.PICKED_UP,
    location: 'Stockholm, Sweden',
    details: 'Package picked up',
    createdAt: '2025-05-26T11:00:00.000Z',
  },
  {
    id: 'event-3',
    shipmentId: 'SHIP-123456',
    timestamp: '2025-05-26T12:00:00.000Z',
    status: ShipmentStatus.IN_TRANSIT,
    location: 'Gothenburg, Sweden',
    details: 'Package in transit',
    createdAt: '2025-05-26T12:00:00.000Z',
  },
];

const mockEvent: APIGatewayProxyEvent = {
  ...mockAPIGatewayEvent,
  pathParameters: {
    shipmentId: 'SHIP-123456',
  },
  path: '/shipments/SHIP-123456/events',
};

describe('getEventHistory handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should retrieve event history successfully', async () => {
      mockGetEventHistory.mockResolvedValue({
        events: mockEvents,
        hasMore: false,
        nextKey: undefined,
      });

      const result = await handler(mockEvent, mockContext, jest.fn())!;
      console.error(result);

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.data).toEqual(mockEvents);
      expect(body.pagination.hasMore).toBe(false);
      expect(body.pagination.nextKey).toBeUndefined();
      expect(body.message).toBe('Retrieved 3 events for shipment SHIP-123456');
      expect(mockGetEventHistory).toHaveBeenCalledWith(
        'SHIP-123456',
        expect.any(Number),
        undefined
      );
    });

    it('should handle pagination with limit', async () => {
      const limitedEvents = mockEvents.slice(0, 2);
      mockGetEventHistory.mockResolvedValue({
        events: limitedEvents,
        hasMore: true,
        nextKey: 'next-page-key',
      });

      const eventWithLimit = {
        ...mockEvent,
        queryStringParameters: {
          limit: '2',
        },
      };

      const result = await handler(eventWithLimit, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.hasMore).toBe(true);
      expect(body.pagination.nextKey).toBe('next-page-key');
      expect(body.message).toBe('Retrieved 2 events for shipment SHIP-123456');
      expect(mockGetEventHistory).toHaveBeenCalledWith('SHIP-123456', 2, undefined);
    });

    it('should handle pagination with startKey', async () => {
      mockGetEventHistory.mockResolvedValue({
        events: [mockEvents[2]],
        hasMore: false,
        nextKey: undefined,
      });

      const eventWithStartKey = {
        ...mockEvent,
        queryStringParameters: {
          startKey: 'previous-page-key',
        },
      };

      const result = await handler(eventWithStartKey, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.pagination.hasMore).toBe(false);
      expect(mockGetEventHistory).toHaveBeenCalledWith(
        'SHIP-123456',
        expect.any(Number),
        'previous-page-key'
      );
    });

    it('should handle pagination with both limit and startKey', async () => {
      mockGetEventHistory.mockResolvedValue({
        events: [mockEvents[1]],
        hasMore: true,
        nextKey: 'another-page-key',
      });

      const eventWithBoth = {
        ...mockEvent,
        queryStringParameters: {
          limit: '1',
          startKey: 'some-start-key',
        },
      };

      const result = await handler(eventWithBoth, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.pagination.hasMore).toBe(true);
      expect(body.pagination.nextKey).toBe('another-page-key');
      expect(mockGetEventHistory).toHaveBeenCalledWith('SHIP-123456', 1, 'some-start-key');
    });

    it('should return empty array for subsequent pages when no more events', async () => {
      mockGetEventHistory.mockResolvedValue({
        events: [],
        hasMore: false,
        nextKey: undefined,
      });

      const eventWithStartKey = {
        ...mockEvent,
        queryStringParameters: {
          startKey: 'last-page-key',
        },
      };

      const result = await handler(eventWithStartKey, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(body.pagination.hasMore).toBe(false);
      expect(body.pagination.nextKey).toBeUndefined();
      expect(body.message).toBe('Retrieved 0 events for shipment SHIP-123456');
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

    it('should return 400 for missing shipment ID', async () => {
      const eventWithMissingShipmentId = {
        ...mockEvent,
        pathParameters: {},
      };

      const result = await handler(eventWithMissingShipmentId, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for null path parameters', async () => {
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

    it('should return 400 for invalid limit parameter', async () => {
      const eventWithInvalidLimit = {
        ...mockEvent,
        queryStringParameters: {
          limit: 'invalid-number',
        },
      };

      const result = await handler(eventWithInvalidLimit, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for negative limit', async () => {
      const eventWithNegativeLimit = {
        ...mockEvent,
        queryStringParameters: {
          limit: '-5',
        },
      };

      const result = await handler(eventWithNegativeLimit, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for limit exceeding maximum', async () => {
      const eventWithLargeLimit = {
        ...mockEvent,
        queryStringParameters: {
          limit: '1000',
        },
      };

      const result = await handler(eventWithLargeLimit, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should handle single event result', async () => {
      mockGetEventHistory.mockResolvedValue({
        events: [mockEvents[0]],
        hasMore: false,
        nextKey: undefined,
      });

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
      expect(body.message).toBe('Retrieved 1 events for shipment SHIP-123456');
    });
  });

  describe('Not Found Cases', () => {
    it('should return 404 when no events found for shipment (first request)', async () => {
      mockGetEventHistory.mockResolvedValue({
        events: [],
        hasMore: false,
        nextKey: undefined,
      });

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.NOT_FOUND);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('No events found for shipment SHIP-123456');

      expect(mockGetEventHistory).toHaveBeenCalledWith(
        'SHIP-123456',
        expect.any(Number),
        undefined
      );
    });

    it('should NOT return 404 for empty subsequent pages (with startKey)', async () => {
      mockGetEventHistory.mockResolvedValue({
        events: [],
        hasMore: false,
        nextKey: undefined,
      });

      const eventWithStartKey = {
        ...mockEvent,
        queryStringParameters: {
          startKey: 'some-key',
        },
      };

      const result = await handler(eventWithStartKey, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle general service errors gracefully', async () => {
      mockGetEventHistory.mockRejectedValue(new Error('Service Error'));

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error occurred while retrieving event history');
    });

    it('should handle ResourceNotFoundException', async () => {
      const resourceError = new Error('Table not found');
      resourceError.name = 'ResourceNotFoundException';
      mockGetEventHistory.mockRejectedValue(resourceError);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.SERVICE_UNAVAILABLE);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Events table not found');
    });

    it('should handle ValidationException from DynamoDB', async () => {
      const validationError = new Error('Invalid parameters');
      validationError.name = 'ValidationException';
      mockGetEventHistory.mockRejectedValue(validationError);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid shipment ID or query parameters');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetEventHistory.mockRejectedValue('String error');

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error occurred while retrieving event history');
    });
  });

  describe('Query parameters edge cases', () => {
    it('should handle empty query parameters object', async () => {
      mockGetEventHistory.mockResolvedValue({
        events: mockEvents,
        hasMore: false,
        nextKey: undefined,
      });

      const eventWithEmptyQuery = {
        ...mockEvent,
        queryStringParameters: {},
      };

      const result = await handler(eventWithEmptyQuery, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);
    });

    it('should handle valid limit of 0', async () => {
      mockGetEventHistory.mockResolvedValue({
        events: [],
        hasMore: true,
        nextKey: 'some-key',
      });

      const eventWithZeroLimit = {
        ...mockEvent,
        queryStringParameters: {
          limit: '0',
        },
      };

      const result = await handler(eventWithZeroLimit, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should handle very long startKey', async () => {
      const longStartKey = 'start-key'.repeat(50);

      mockGetEventHistory.mockResolvedValue({
        events: [],
        hasMore: false,
        nextKey: undefined,
      });

      const eventWithLongKey = {
        ...mockEvent,
        queryStringParameters: {
          startKey: longStartKey,
        },
      };

      const result = await handler(eventWithLongKey, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      expect(mockGetEventHistory).toHaveBeenCalledWith(
        'SHIP-123456',
        expect.any(Number),
        longStartKey
      );
    });
  });
});
