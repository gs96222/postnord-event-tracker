import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddbMock, resetMocks } from '../../../mocks'; // Import your existing mock
import {
  shippmentEventExist,
  createEvent,
  getEventHistory,
  getLatestEvent,
} from '../../services/aws.dynamo.service';
import { ShipmentEvent, ShipmentStatus } from '../../models';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

const mockShipmentEvent: ShipmentEvent = {
  id: 'test-uuid-123',
  shipmentId: 'SHIP-123456',
  timestamp: '2025-05-26T10:00:00.000Z',
  status: ShipmentStatus.PICKED_UP,
  location: 'Stockholm, Sweden',
  details: 'Package picked up from sender',
  createdAt: '2025-05-26T10:00:00.000Z',
};

const mockEvents: ShipmentEvent[] = [
  {
    id: 'event-1',
    shipmentId: 'SHIP-123456',
    timestamp: '2025-05-26T08:00:00.000Z',
    status: ShipmentStatus.CREATED,
    location: 'Stockholm, Sweden',
    details: 'Shipment created',
    createdAt: '2025-05-26T08:00:00.000Z',
  },
  {
    id: 'event-2',
    shipmentId: 'SHIP-123456',
    timestamp: '2025-05-26T10:00:00.000Z',
    status: ShipmentStatus.PICKED_UP,
    location: 'Stockholm, Sweden',
    details: 'Package picked up',
    createdAt: '2025-05-26T10:00:00.000Z',
  },
  {
    id: 'event-3',
    shipmentId: 'SHIP-123456',
    timestamp: '2025-05-26T12:00:00.000Z',
    status: ShipmentStatus.DELIVERED,
    location: 'Stockholm, Sweden',
    details: 'Package delivered',
    createdAt: '2025-05-26T12:00:00.000Z',
  },
];

describe('DynamoDB Service', () => {
  beforeEach(() => {
    resetMocks();
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-05-26T10:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('shippmentEventExist', () => {
    it('should return exists: true when event is found', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [mockShipmentEvent],
        Count: 1,
      });

      const result = await shippmentEventExist(
        'SHIP-123456',
        ShipmentStatus.PICKED_UP,
        '2025-05-26T10:00:00.000Z'
      );

      expect(result.exists).toBe(true);
      expect(result.existingEvent).toEqual(mockShipmentEvent);

      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
      const queryCall = ddbMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input).toEqual({
        TableName: 'test-shipment-events',
        KeyConditionExpression: 'shipmentId = :shipmentId',
        FilterExpression: '#status = :status AND #timestamp = :timestamp',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#timestamp': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':shipmentId': 'SHIP-123456',
          ':status': ShipmentStatus.PICKED_UP,
          ':timestamp': '2025-05-26T10:00:00.000Z',
        },
        Limit: 1,
      });
    });

    it('should return {exists: false} when no event is found', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0,
      });

      const result = await shippmentEventExist(
        'SHIP-123456',
        ShipmentStatus.PICKED_UP,
        '2025-05-26T10:00:00.000Z'
      );

      expect(result.exists).toBe(false);
      expect(result.existingEvent).toBeUndefined();
    });

    it('should return {exists: false} when Items is undefined', async () => {
      ddbMock.on(QueryCommand).resolves({
        Count: 0,
      });

      const result = await shippmentEventExist(
        'SHIP-123456',
        ShipmentStatus.PICKED_UP,
        '2025-05-26T10:00:00.000Z'
      );

      expect(result.exists).toBe(false);
      expect(result.existingEvent).toBeUndefined();
    });

    it('should handle different shipment statuses', async () => {
      const statuses = [
        ShipmentStatus.CREATED,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.DELIVERED,
      ];

      for (const status of statuses) {
        ddbMock.on(QueryCommand).resolves({
          Items: [{ ...mockShipmentEvent, status }],
          Count: 1,
        });

        const result = await shippmentEventExist('SHIP-123456', status, '2025-05-26T10:00:00.000Z');

        expect(result.exists).toBe(true);
        expect(result.existingEvent?.status).toBe(status);
      }
    });

    it('should handle DynamoDB errors', async () => {
      const dynamoError = new Error('DynamoDB Error');
      dynamoError.name = 'ResourceNotFoundException';
      ddbMock.on(QueryCommand).rejects(dynamoError);

      await expect(
        shippmentEventExist('SHIP-123456', ShipmentStatus.PICKED_UP, '2025-05-26T10:00:00.000Z')
      ).rejects.toThrow('DynamoDB Error');
    });
  });

  describe('createEvent', () => {
    it('should create a new event successfully', async () => {
      ddbMock.on(PutCommand).resolves({});

      const eventData = {
        timestamp: '2025-05-26T10:00:00.000Z',
        status: ShipmentStatus.PICKED_UP,
        location: 'Stockholm, Sweden',
        details: 'Package picked up from sender',
      };

      const result = await createEvent('SHIP-123456', eventData);

      expect(result).toEqual({
        id: 'test-uuid-123',
        shipmentId: 'SHIP-123456',
        timestamp: '2025-05-26T10:00:00.000Z',
        status: ShipmentStatus.PICKED_UP,
        location: 'Stockholm, Sweden',
        details: 'Package picked up from sender',
        createdAt: '2025-05-26T10:00:00.000Z',
      });

      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
      const putCall = ddbMock.commandCalls(PutCommand)[0];
      expect(putCall.args[0].input).toEqual({
        TableName: 'test-shipment-events',
        Item: {
          id: 'test-uuid-123',
          shipmentId: 'SHIP-123456',
          timestamp: '2025-05-26T10:00:00.000Z',
          status: ShipmentStatus.PICKED_UP,
          location: 'Stockholm, Sweden',
          details: 'Package picked up from sender',
          createdAt: '2025-05-26T10:00:00.000Z',
        },
      });
    });

    it('should create event with default timestamp when not provided', async () => {
      ddbMock.on(PutCommand).resolves({});

      const eventData = {
        status: ShipmentStatus.CREATED,
        location: 'Stockholm, Sweden',
      };

      const result = await createEvent('SHIP-123456', eventData);

      expect(result.timestamp).toBe('2025-05-26T10:00:00.000Z');
      expect(result.createdAt).toBe('2025-05-26T10:00:00.000Z');
    });

    it('should create event with minimal required fields', async () => {
      ddbMock.on(PutCommand).resolves({});

      const eventData = {
        status: ShipmentStatus.CREATED,
      };

      const result = await createEvent('SHIP-123456', eventData);

      expect(result).toEqual({
        id: 'test-uuid-123',
        shipmentId: 'SHIP-123456',
        timestamp: '2025-05-26T10:00:00.000Z',
        status: ShipmentStatus.CREATED,
        location: undefined,
        details: undefined,
        createdAt: '2025-05-26T10:00:00.000Z',
      });
    });

    it('should handle ConditionalCheckFailedException', async () => {
      const conditionalError = new Error('ConditionalCheckFailedException');
      conditionalError.name = 'ConditionalCheckFailedException';
      ddbMock.on(PutCommand).rejects(conditionalError);

      const eventData = {
        status: ShipmentStatus.CREATED,
      };

      await expect(createEvent('SHIP-123456', eventData)).rejects.toThrow(
        'ConditionalCheckFailedException'
      );
    });

    it('should handle ValidationException', async () => {
      const validationError = new Error('ValidationException');
      validationError.name = 'ValidationException';
      ddbMock.on(PutCommand).rejects(validationError);

      const eventData = {
        status: ShipmentStatus.CREATED,
      };

      await expect(createEvent('SHIP-123456', eventData)).rejects.toThrow('ValidationException');
    });

    it('should handle different shipment statuses', async () => {
      const statuses = [
        ShipmentStatus.CREATED,
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.OUT_FOR_DELIVERY,
        ShipmentStatus.DELIVERED,
      ];

      for (const status of statuses) {
        ddbMock.on(PutCommand).resolves({});

        const eventData = { status };
        const result = await createEvent('SHIP-123456', eventData);
        expect(result.status).toBe(status);
      }
    });
  });

  describe('getEventHistory', () => {
    it('should retrieve event history with default parameters', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: mockEvents,
        LastEvaluatedKey: undefined,
      });

      const result = await getEventHistory('SHIP-123456');

      expect(result.events).toHaveLength(3);
      expect(result.hasMore).toBe(false);
      expect(result.nextKey).toBeUndefined();

      expect(result.events[0].timestamp).toBe('2025-05-26T08:00:00.000Z');
      expect(result.events[1].timestamp).toBe('2025-05-26T10:00:00.000Z');
      expect(result.events[2].timestamp).toBe('2025-05-26T12:00:00.000Z');

      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
      const queryCall = ddbMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input).toEqual({
        TableName: 'test-shipment-events',
        KeyConditionExpression: 'shipmentId = :shipmentId',
        ExpressionAttributeValues: {
          ':shipmentId': 'SHIP-123456',
        },
        Limit: 50,
      });
    });

    it('should handle pagination with limit', async () => {
      const limitedEvents = mockEvents.slice(0, 2);
      const lastEvaluatedKey = { shipmentId: 'SHIP-123456', timestamp: 'some-key' };

      ddbMock.on(QueryCommand).resolves({
        Items: limitedEvents,
        LastEvaluatedKey: lastEvaluatedKey,
      });

      const result = await getEventHistory('SHIP-123456', 2);

      expect(result.events).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextKey).toBeDefined();

      const decodedKey = JSON.parse(Buffer.from(result.nextKey!, 'base64').toString());
      expect(decodedKey).toEqual(lastEvaluatedKey);

      const queryCall = ddbMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input.Limit).toBe(2);
    });

    it('should handle pagination with startKey', async () => {
      const startKeyData = { shipmentId: 'SHIP-123456', timestamp: 'start-key' };
      const startKey = Buffer.from(JSON.stringify(startKeyData)).toString('base64');

      ddbMock.on(QueryCommand).resolves({
        Items: [mockEvents[2]],
        LastEvaluatedKey: undefined,
      });

      const result = await getEventHistory('SHIP-123456', 50, startKey);

      expect(result.events).toHaveLength(1);
      expect(result.hasMore).toBe(false);

      const queryCall = ddbMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input.ExclusiveStartKey).toEqual(startKeyData);
    });

    it('should return empty array when no events found', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const result = await getEventHistory('SHIP-NONEXISTENT');

      expect(result.events).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextKey).toBeUndefined();
    });

    it('should handle undefined Items from DynamoDB', async () => {
      ddbMock.on(QueryCommand).resolves({
        LastEvaluatedKey: undefined,
      });

      const result = await getEventHistory('SHIP-123456');

      expect(result.events).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should sort events chronologically (oldest first)', async () => {
      const unsortedEvents = [...mockEvents].reverse();
      ddbMock.on(QueryCommand).resolves({
        Items: unsortedEvents,
        LastEvaluatedKey: undefined,
      });

      const result = await getEventHistory('SHIP-123456');

      // Should be sorted oldest first
      expect(result.events[0].status).toBe(ShipmentStatus.CREATED);
      expect(result.events[1].status).toBe(ShipmentStatus.PICKED_UP);
      expect(result.events[2].status).toBe(ShipmentStatus.DELIVERED);
    });

    it('should handle DynamoDB query errors', async () => {
      const queryError = new Error('Query failed');
      queryError.name = 'ResourceNotFoundException';
      ddbMock.on(QueryCommand).rejects(queryError);

      await expect(getEventHistory('SHIP-123456')).rejects.toThrow('Query failed');
    });

    it('should handle invalid base64 startKey', async () => {
      const invalidStartKey = 'not-base64';

      await expect(getEventHistory('SHIP-123456', 50, invalidStartKey)).rejects.toThrow();
    });
  });

  describe('getLatestEvent', () => {
    it('should retrieve the latest event successfully', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: mockEvents,
      });

      const result = await getLatestEvent('SHIP-123456');

      expect(result?.status).toBe(ShipmentStatus.DELIVERED);
      expect(result?.timestamp).toBe('2025-05-26T12:00:00.000Z');
      expect(result?.id).toBe('event-3');

      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
      const queryCall = ddbMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input).toEqual({
        TableName: 'test-shipment-events',
        KeyConditionExpression: 'shipmentId = :shipmentId',
        ExpressionAttributeValues: {
          ':shipmentId': 'SHIP-123456',
        },
        Limit: 1,
      });
    });

    it('should return null when no events found', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await getLatestEvent('SHIP-NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should return null when Items is undefined', async () => {
      ddbMock.on(QueryCommand).resolves({});

      const result = await getLatestEvent('SHIP-123456');

      expect(result).toBeNull();
    });

    it('should sort events by timestamp descending (newest first)', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [...mockEvents].reverse(),
      });

      const result = await getLatestEvent('SHIP-123456');

      expect(result?.timestamp).toBe('2025-05-26T12:00:00.000Z');
      expect(result?.status).toBe(ShipmentStatus.DELIVERED);
    });

    it('should handle DynamoDB query errors', async () => {
      const queryError = new Error('Query failed');
      queryError.name = 'ValidationException';
      ddbMock.on(QueryCommand).rejects(queryError);

      await expect(getLatestEvent('SHIP-123456')).rejects.toThrow('Query failed');
    });
  });
});
