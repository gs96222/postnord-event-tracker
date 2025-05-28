import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { handler } from '../../api/getLatestEvent';
import { getLatestEvent } from '../../services';
import { ShipmentStatus } from '../../models';
import { mockAPIGatewayEvent, mockContext } from '../../../mocks';

jest.mock('../../services');

const mockGetLatestEvent = getLatestEvent as jest.MockedFunction<typeof getLatestEvent>;

const mockLatestEvent = {
  id: 'event-latest',
  shipmentId: 'SHIP-123456',
  timestamp: '2025-05-26T12:00:00.000Z',
  status: ShipmentStatus.DELIVERED,
  location: 'Stockholm, Sweden',
  details: 'Package delivered successfully',
  createdAt: '2025-05-26T12:00:00.000Z',
};

const mockEvent: APIGatewayProxyEvent = {
  ...mockAPIGatewayEvent,
  httpMethod: 'GET',
  path: '/shipments/SHIP-123456/events/latest',
};

describe('getLatestEvent handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should retrieve latest event successfully', async () => {
      mockGetLatestEvent.mockResolvedValue(mockLatestEvent);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Latest event retrieved successfully');
      expect(body.data).toEqual(mockLatestEvent);
      expect(body.data.id).toBe('event-latest');
      expect(body.data.shipmentId).toBe('SHIP-123456');
      expect(body.data.status).toBe(ShipmentStatus.DELIVERED);

      expect(mockGetLatestEvent).toHaveBeenCalledWith('SHIP-123456');
      expect(mockGetLatestEvent).toHaveBeenCalledTimes(1);
    });

    it('should handle different shipment IDs', async () => {
      const differentShipmentIds = ['SHIP-789012', 'SHIP-345678', 'SHIP-901234'];

      for (const shipmentId of differentShipmentIds) {
        const eventForDifferentShipment = {
          ...mockEvent,
          pathParameters: { shipmentId },
        };

        const latestEventForShipment = {
          ...mockLatestEvent,
          shipmentId,
          id: `event-${shipmentId}`,
        };

        mockGetLatestEvent.mockResolvedValue(latestEventForShipment);

        const result = await handler(eventForDifferentShipment, mockContext, jest.fn())!;

        expect(result.statusCode).toBe(StatusCodes.OK);

        const body = JSON.parse(result.body);
        expect(body.data.shipmentId).toBe(shipmentId);

        expect(mockGetLatestEvent).toHaveBeenCalledWith(shipmentId);
      }
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
      expect(mockGetLatestEvent).not.toHaveBeenCalled();
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

      expect(mockGetLatestEvent).not.toHaveBeenCalled();
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

      expect(mockGetLatestEvent).not.toHaveBeenCalled();
    });

    it('should handle shipment ID format validation', async () => {
      const eventWithTestFormat = {
        ...mockEvent,
        pathParameters: { shipmentId: '123' },
      };

      mockGetLatestEvent.mockResolvedValue(null);

      const result = await handler(eventWithTestFormat, mockContext, jest.fn())!;

      expect(StatusCodes.BAD_REQUEST).toBe(result.statusCode);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);

      expect(body.error).toBe('Validation failed');
      expect(mockGetLatestEvent).not.toHaveBeenCalled();
    });
  });

  describe('Not Found Cases', () => {
    it('should return 404 when no events found for shipment', async () => {
      mockGetLatestEvent.mockResolvedValue(null);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.NOT_FOUND);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('No events found for shipment SHIP-123456');

      expect(mockGetLatestEvent).toHaveBeenCalledWith('SHIP-123456');
      expect(mockGetLatestEvent).toHaveBeenCalledTimes(1);
    });

    it('should return 404 when service returns undefined', async () => {
      mockGetLatestEvent.mockResolvedValue(undefined as any);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.NOT_FOUND);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('No events found for shipment SHIP-123456');
    });
  });

  describe('Error Handling', () => {
    it('should handle general service errors gracefully', async () => {
      mockGetLatestEvent.mockRejectedValue(new Error('Service Error'));

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error occurred while retrieving latest event');

      expect(mockGetLatestEvent).toHaveBeenCalledWith('SHIP-123456');
    });

    it('should handle ResourceNotFoundException', async () => {
      const resourceError = new Error('Table not found');
      resourceError.name = 'ResourceNotFoundException';
      mockGetLatestEvent.mockRejectedValue(resourceError);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.SERVICE_UNAVAILABLE);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Events table not found');

      expect(mockGetLatestEvent).toHaveBeenCalledWith('SHIP-123456');
    });

    it('should handle ValidationException from DynamoDB', async () => {
      const validationError = new Error('Invalid parameters');
      validationError.name = 'ValidationException';
      mockGetLatestEvent.mockRejectedValue(validationError);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid shipment ID format');

      expect(mockGetLatestEvent).toHaveBeenCalledWith('SHIP-123456');
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockGetLatestEvent.mockRejectedValue(timeoutError);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error occurred while retrieving latest event');
    });
  });

  describe('Edge Cases', () => {
    it('should handle shipment ID with special characters', async () => {
      const specialShipmentId = 'SHIP-123_456-ABC';

      const eventWithSpecialId = {
        ...mockEvent,
        pathParameters: { shipmentId: specialShipmentId },
      };

      const eventForSpecialId = {
        ...mockLatestEvent,
        shipmentId: specialShipmentId,
      };

      mockGetLatestEvent.mockResolvedValue(eventForSpecialId);

      const result = await handler(eventWithSpecialId, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.data.shipmentId).toBe(specialShipmentId);

      expect(mockGetLatestEvent).toHaveBeenCalledWith(specialShipmentId);
    });

    it('should fail on shipment ID with unicode characters', async () => {
      const specialShipmentId = 'SHIP-123_456-ABC🇸🇪';

      const eventWithSpecialId = {
        ...mockEvent,
        pathParameters: { shipmentId: specialShipmentId },
      };

      const eventForSpecialId = {
        ...mockLatestEvent,
        shipmentId: specialShipmentId,
      };

      mockGetLatestEvent.mockResolvedValue(eventForSpecialId);

      const result = await handler(eventWithSpecialId, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('should handle event with unicode characters', async () => {
      const eventWithUnicode = {
        ...mockLatestEvent,
        location: 'Stockholm, Sweden 🇸🇪',
        details: 'Package delivered successfully ✅',
      };

      mockGetLatestEvent.mockResolvedValue(eventWithUnicode);

      const result = await handler(mockEvent, mockContext, jest.fn())!;

      expect(result.statusCode).toBe(StatusCodes.OK);

      const body = JSON.parse(result.body);
      expect(body.data.location).toBe('Stockholm, Sweden 🇸🇪');
      expect(body.data.details).toBe('Package delivered successfully ✅');
    });
  });
});
