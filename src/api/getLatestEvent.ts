import { APIGatewayProxyHandler } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';

import { ShipmentEventParamsSchema } from '../validators';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '../utils/response';
import { ShipmentEventParams } from '../models';
import { getLatestEvent } from '../services';

export const handler: APIGatewayProxyHandler = async (event, context) => {
  console.log('Get Latest Event Handler - Event:', JSON.stringify(event, null, 2));
  console.log('Get Latest Event Handler - Context:', JSON.stringify(context, null, 2));

  try {
    const paramsResult = ShipmentEventParamsSchema.safeParse(event.pathParameters);
    if (!paramsResult.success) {
      return validationErrorResponse(['Invalid shipment ID']);
    }

    const { shipmentId } = paramsResult.data as ShipmentEventParams;

    const latestEvent = await getLatestEvent(shipmentId);

    if (!latestEvent) {
      return errorResponse(
        `No events found for shipment ${shipmentId}`,
        StatusCodes.NOT_FOUND
      );
    }

    console.log(`Latest event retrieved for shipment ${shipmentId}`);

    return successResponse(
      latestEvent,
      'Latest event retrieved successfully'
    );

  } catch (error) {
    console.error('Error retrieving latest event:', error);

    if (error instanceof Error) {
      if (error.name === 'ResourceNotFoundException') {
        return errorResponse(
          'Events table not found',
          StatusCodes.SERVICE_UNAVAILABLE
        );
      }

      if (error.name === 'ValidationException') {
        return errorResponse(
          'Invalid shipment ID format',
          StatusCodes.BAD_REQUEST
        );
      }
    }

    return errorResponse(
      'Internal server error occurred while retrieving latest event',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};