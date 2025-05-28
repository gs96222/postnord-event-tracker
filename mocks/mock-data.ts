import { APIGatewayProxyEvent } from 'aws-lambda';
import { ShipmentEvent, ShipmentStatus } from '../src/models';


export const mockShipmentEvent: ShipmentEvent = {
  id: 'test-event-id-123',
  shipmentId: 'SHIP-123456',
  timestamp: '2024-01-15T10:30:00.000Z',
  status: ShipmentStatus.IN_TRANSIT,
  location: 'Stockholm, Sweden',
  details: 'Package is in transit between facilities',
  createdAt: '2024-01-15T10:30:00.000Z',
};

export const mockCreateEventRequest = {
  timestamp: '2024-01-15T10:30:00.000Z',
  status: ShipmentStatus.PICKED_UP,
  location: 'Stockholm, Sweden',
  details: 'Package picked up from sender',
};

export const mockAPIGatewayEvent: APIGatewayProxyEvent = {
  httpMethod: 'POST',
  pathParameters: { shipmentId: 'SHIP-123456' },
  body: '{"timestamp":"2025-05-26T10:00:00.000Z","status":"picked_up"}',
  headers: {},
  requestContext: {} as any,
  queryStringParameters: null,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  resource: '',
  stageVariables: null,
  isBase64Encoded: false,
  path: '/test',
};

export const mockContext = {
  awsRequestId: 'test-123',
  functionName: 'test-fn',
  functionVersion: '1',
  invokedFunctionArn: 'arn:test',
  memoryLimitInMB: '128',
  logGroupName: '/test',
  logStreamName: 'test',
  getRemainingTimeInMillis: () => 30000,
  callbackWaitsForEmptyEventLoop: false,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

export const createMockEventHistory = (count: number): ShipmentEvent[] => {
  return Array.from({ length: count }, (_, index) => ({
    ...mockShipmentEvent,
    id: `event-${index + 1}`,
    timestamp: new Date(Date.now() - (count - index) * 60000).toISOString(),
    status: Object.values(ShipmentStatus)[index % Object.values(ShipmentStatus).length],
  }));
};