import { APIGatewayProxyHandler } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid';

import { createEvent, shippmentEventExist } from '../services';
import {
  CreateEventSchema,
  ShipmentEventParamsSchema,
  validateEventTimestamp,
} from '../validators';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  parseJSON,
} from '../utils/response';
import {
  ALLOWED_STATUS_TRANSITIONS,
  CreateEventRequest,
  SHIPMENT_STATUS_DESCRIPTIONS,
  ShipmentEvent,
} from '../models';

export const handler: APIGatewayProxyHandler = async (event, context) => {
  console.log('Record Event Handler - Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  try {
    const paramsResult = ShipmentEventParamsSchema.safeParse(event.pathParameters);
    if (!paramsResult.success) {
      return validationErrorResponse(['Invalid shipment ID']);
    }

    const { shipmentId } = paramsResult.data;

    if (!event.body) {
      return errorResponse('Request body is required', StatusCodes.BAD_REQUEST);
    }

    const requestBody = parseJSON(event.body);
    if (!requestBody) {
      return errorResponse('Invalid JSON in request body', StatusCodes.BAD_REQUEST);
    }

    const bodyResult = CreateEventSchema.safeParse(requestBody);
    if (!bodyResult.success) {
      const errors = bodyResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return validationErrorResponse(errors);
    }

    const { timestamp, status, location, details } = bodyResult.data as CreateEventRequest;

    if (!validateEventTimestamp(timestamp)) {
      return errorResponse('Event timestamp cannot be in the future', StatusCodes.BAD_REQUEST);
    }

    const checkforDuplicateEvent = await shippmentEventExist(shipmentId, status, timestamp);

    if (checkforDuplicateEvent.exists) {
      return errorResponse(
        'Event with this shipment ID, status and timestamp already exists',
        StatusCodes.CONFLICT
      );
    }

    const shipmentEvent: ShipmentEvent = {
      id: uuidv4(),
      shipmentId,
      timestamp,
      status,
      location,
      details: details || SHIPMENT_STATUS_DESCRIPTIONS[status],
      createdAt: new Date().toISOString(),
    };

    await createEvent(shipmentId, shipmentEvent);

    console.log(`Event created successfully for shipment ${shipmentId}`);

    return successResponse(shipmentEvent, 'Event created successfully', StatusCodes.CREATED);
  } catch (error) {
    console.error('Error creating event:', error);

    // Handle specific DynamoDB errors
    if (error instanceof Error) {
      if (error.name === 'ConditionalCheckFailedException') {
        return errorResponse('Event with this ID already exists', StatusCodes.CONFLICT);
      }

      if (error.name === 'ValidationException') {
        return errorResponse('Invalid data format', StatusCodes.BAD_REQUEST);
      }
    }

    return errorResponse(
      'Internal server error occurred while creating event',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
