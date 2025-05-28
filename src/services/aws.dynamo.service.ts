import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { ShipmentEvent, ShipmentStatus } from '../models';
import { v4 as uuidv4 } from 'uuid';

// Configuration for local vs production
const isLocal = process.env.AWS_SAM_LOCAL === 'true' || process.env.NODE_ENV === 'development';

const clientConfig = isLocal
  ? {
      region: 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT || 'http://host.docker.internal:8000',
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
      },
    }
  : {
      region: process.env.AWS_REGION || 'us-east-1',
    };

const client = new DynamoDBClient(clientConfig);

//TODO: Add better handling to initialize the client to use the correct credentials for production
// const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1', credentials: {
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
// }} );
const docClient = DynamoDBDocumentClient.from(client);

const SHIPMENT_EVENTS_TABLE = process.env.SHIPMENT_EVENTS_TABLE || 'shipment-events';

export const shippmentEventExist = async (
  shipmentId: string,
  status: ShipmentStatus,
  timestamp: string
): Promise<{ exists: boolean; existingEvent?: ShipmentEvent }> => {
  const command = new QueryCommand({
    TableName: SHIPMENT_EVENTS_TABLE,
    KeyConditionExpression: 'shipmentId = :shipmentId',
    FilterExpression: '#status = :status AND #timestamp = :timestamp',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#timestamp': 'timestamp',
    },
    ExpressionAttributeValues: {
      ':shipmentId': shipmentId,
      ':status': status,
      ':timestamp': timestamp,
    },
    Limit: 1,
  });

  const result = await docClient.send(command);

  return {
    exists: (result.Items?.length || 0) > 0,
    existingEvent: result.Items?.[0] as ShipmentEvent,
  };
};

export const createEvent = async (
  shipmentId: string,
  eventData: Partial<ShipmentEvent>
): Promise<ShipmentEvent> => {
  const event: ShipmentEvent = {
    id: uuidv4(),
    shipmentId,
    timestamp: eventData.timestamp || new Date().toISOString(),
    status: eventData.status!,
    location: eventData.location,
    details: eventData.details,
    createdAt: new Date().toISOString(),
  };

  const command = new PutCommand({
    TableName: SHIPMENT_EVENTS_TABLE,
    Item: event,
  });

  await docClient.send(command);
  return event;
};

export const getEventHistory = async (
  shipmentId: string,
  limit: number = 50,
  startKey?: string
): Promise<{
  events: ShipmentEvent[];
  hasMore: boolean;
  nextKey?: string;
}> => {
  const command = new QueryCommand({
    TableName: SHIPMENT_EVENTS_TABLE,
    KeyConditionExpression: 'shipmentId = :shipmentId',
    ExpressionAttributeValues: {
      ':shipmentId': shipmentId,
    },
    Limit: limit,
    ...(startKey && {
      ExclusiveStartKey: JSON.parse(Buffer.from(startKey, 'base64').toString()),
    }),
  });

  const result: QueryCommandOutput = await docClient.send(command);

  // Sortting by timestamp -> (oldest first)
  const sortedEvents = (result.Items || []).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    events: (sortedEvents || []) as ShipmentEvent[],
    hasMore: !!result.LastEvaluatedKey,
    nextKey: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined,
  };
};

export const getLatestEvent = async (shipmentId: string): Promise<ShipmentEvent | null> => {
  const command = new QueryCommand({
    TableName: SHIPMENT_EVENTS_TABLE,
    KeyConditionExpression: 'shipmentId = :shipmentId',
    ExpressionAttributeValues: {
      ':shipmentId': shipmentId,
    },
    Limit: 1,
  });

  const result = await docClient.send(command);

  // Sortting by timestamp
  const sortedEvents = (result.Items || []).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return (sortedEvents[0] as ShipmentEvent) || null;
};
