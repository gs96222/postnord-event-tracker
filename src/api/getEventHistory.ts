import { APIGatewayProxyHandler } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';

import {
  ShipmentEventParamsSchema,
  GetEventsQuerySchema,
} from '../validators';
import {
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
} from '../utils/response';
import { GetEventsQuery, ShipmentEventParams } from '../models';
import { getEventHistory } from '../services';

export const handler: APIGatewayProxyHandler = async (event, context) => {
  console.log('Get Event History Handler - Event:', JSON.stringify(event, null, 2));
  console.log('Get Event History Handler - Context:', JSON.stringify(context, null, 2));

  try {
    const paramsResult = ShipmentEventParamsSchema.safeParse(event.pathParameters);
    if (!paramsResult.success) {
      return validationErrorResponse(['Invalid shipment ID']);
    }

    const { shipmentId } = paramsResult.data as ShipmentEventParams;

    const queryResult = GetEventsQuerySchema.safeParse(event.queryStringParameters || {});
    if (!queryResult.success) {
      const errors = queryResult.error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      );
      return validationErrorResponse(errors);
    }

    const { limit, startKey } = queryResult.data as GetEventsQuery;

    const result = await getEventHistory(shipmentId, limit, startKey);

    if (result.events.length === 0 && !startKey) {
      return errorResponse(
        `No events found for shipment ${shipmentId}`,
        StatusCodes.NOT_FOUND
      );
    }

    console.log(`Event history retrieved for shipment ${shipmentId}, found ${result.events.length} events`);

    return paginatedResponse(
      result.events,
      result.hasMore,
      result.nextKey,
      `Retrieved ${result.events.length} events for shipment ${shipmentId}`
    );

  } catch (error) {
    console.error('Error retrieving event history:', error);

    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.name === 'ResourceNotFoundException') {
        return errorResponse(
          'Events table not found',
          StatusCodes.SERVICE_UNAVAILABLE
        );
      }

      if (error.name === 'ValidationException') {
        return errorResponse(
          'Invalid shipment ID or query parameters',
          StatusCodes.BAD_REQUEST
        );
      }
    }

    return errorResponse(
      'Internal server error occurred while retrieving event history',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};