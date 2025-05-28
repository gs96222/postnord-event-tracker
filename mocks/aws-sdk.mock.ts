import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Create mock client for DynamoDB Document Client
export const ddbMock = mockClient(DynamoDBDocumentClient);

export const resetMocks = () => {
  ddbMock.reset();
};